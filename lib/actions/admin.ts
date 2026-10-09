"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/data/org";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPlan, getPlanByLookupKey, type PlanKey } from "@/lib/plans";

// Ações do admin geral sobre as contas e os custos da plataforma.
// Todas conferem se quem chama é o admin geral antes de usar a service role.

export interface AdminResult {
  ok: boolean;
  error?: string;
}

async function guard(): Promise<AdminResult | null> {
  if (!(await isSuperAdmin())) return { ok: false, error: "Apenas o admin geral pode fazer isso." };
  return null;
}

async function currentBilling(orgId: string) {
  const db = createAdminClient();
  const { data } = await db.from("org_billing").select("*").eq("organization_id", orgId).maybeSingle();
  return data as { status?: string; plan?: string; manual?: boolean; stripe_subscription_id?: string | null } | null;
}

const done = (): AdminResult => {
  revalidatePath("/admin");
  return { ok: true };
};

// Libera a conta como cortesia no plano escolhido (sem cobrança na Stripe).
export async function grantAccess(orgId: string, plan: PlanKey, note?: string): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!getPlan(plan)) return { ok: false, error: "Plano inválido." };

  const db = createAdminClient();
  const { error } = await db.from("org_billing").upsert(
    { organization_id: orgId, plan, status: "comp", manual: true, admin_note: note?.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: "organization_id" },
  );
  if (error) return { ok: false, error: error.message };
  return done();
}

// Troca o plano. Se a conta paga pela Stripe (e não está em modo manual),
// troca o preço da assinatura lá (com proporcional); o webhook confirma.
export async function changePlan(orgId: string, plan: PlanKey): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return denied;
  const p = getPlan(plan);
  if (!p) return { ok: false, error: "Plano inválido." };

  const b = await currentBilling(orgId);
  const db = createAdminClient();

  if (b?.stripe_subscription_id && !b.manual && isStripeConfigured && ["active", "trialing", "past_due"].includes(b.status ?? "")) {
    try {
      const stripe = getStripe();
      const prices = await stripe.prices.list({ lookup_keys: [p.lookupKey], active: true, limit: 1 });
      if (!prices.data[0]) return { ok: false, error: "Preço do plano não encontrado na Stripe." };
      const sub = await stripe.subscriptions.retrieve(b.stripe_subscription_id);
      const item = sub.items.data[0];
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, price: prices.data[0].id }],
        proration_behavior: "create_prorations",
        metadata: { ...sub.metadata, plan: p.key },
      });
    } catch (e) {
      return { ok: false, error: `Stripe: ${e instanceof Error ? e.message : String(e)}` };
    }
    await db.from("org_billing").update({ plan, updated_at: new Date().toISOString() }).eq("organization_id", orgId);
    return done();
  }

  // Conta sem Stripe (cortesia/antiga/sem plano): só muda o plano e mantém o acesso.
  const status = b?.status && ["comp", "legacy"].includes(b.status) ? b.status : "comp";
  const { error } = await db.from("org_billing").upsert(
    { organization_id: orgId, plan, status, manual: true, updated_at: new Date().toISOString() },
    { onConflict: "organization_id" },
  );
  if (error) return { ok: false, error: error.message };
  return done();
}

// Bloqueia o acesso. Opcionalmente para a cobrança na Stripe (cancela no fim
// do período já pago, sem estorno).
export async function blockAccount(orgId: string, stopBilling: boolean, note?: string): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return denied;
  const b = await currentBilling(orgId);

  if (stopBilling && b?.stripe_subscription_id && isStripeConfigured) {
    try {
      await getStripe().subscriptions.update(b.stripe_subscription_id, { cancel_at_period_end: true });
    } catch (e) {
      return { ok: false, error: `Stripe: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const db = createAdminClient();
  const { error } = await db.from("org_billing").upsert(
    { organization_id: orgId, status: "blocked", manual: true, admin_note: note?.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: "organization_id" },
  );
  if (error) return { ok: false, error: error.message };
  return done();
}

// Devolve a conta para a Stripe: tira o modo manual e copia o estado atual
// da assinatura. Sem assinatura, a conta fica sem plano (vai escolher um).
export async function returnToStripe(orgId: string): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return denied;
  const b = await currentBilling(orgId);
  const db = createAdminClient();

  if (b?.stripe_subscription_id && isStripeConfigured) {
    try {
      const sub = await getStripe().subscriptions.retrieve(b.stripe_subscription_id);
      const item = sub.items.data[0];
      const ts = (n?: number | null) => (n ? new Date(n * 1000).toISOString() : null);
      await db.from("org_billing").update({
        manual: false,
        status: sub.status,
        plan: getPlanByLookupKey(item?.price?.lookup_key)?.key ?? getPlan(sub.metadata?.plan)?.key ?? b.plan ?? null,
        trial_ends_at: ts(sub.trial_end),
        current_period_end: ts(item?.current_period_end),
        cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
        updated_at: new Date().toISOString(),
      }).eq("organization_id", orgId);
    } catch (e) {
      return { ok: false, error: `Stripe: ${e instanceof Error ? e.message : String(e)}` };
    }
    return done();
  }

  const { error } = await db.from("org_billing").update({ manual: false, status: "none", updated_at: new Date().toISOString() }).eq("organization_id", orgId);
  if (error) return { ok: false, error: error.message };
  return done();
}

/* ------------------------------ custos ------------------------------ */
export interface CostInput {
  description: string;
  category: string;
  amount: number; // em reais
  kind: "monthly" | "once";
  startsOn: string; // AAAA-MM-DD
  endsOn?: string | null;
}

export async function addCost(input: CostInput): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!input.description.trim()) return { ok: false, error: "Descreva o custo." };
  const cents = Math.round(Number(input.amount) * 100);
  if (!Number.isFinite(cents) || cents < 0) return { ok: false, error: "Valor inválido." };

  const db = createAdminClient();
  const { error } = await db.from("admin_costs").insert({
    description: input.description.trim(),
    category: input.category || "outros",
    amount_cents: cents,
    kind: input.kind,
    starts_on: input.startsOn,
    ends_on: input.kind === "monthly" ? input.endsOn || null : null,
  });
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function deleteCost(id: string): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return denied;
  const db = createAdminClient();
  const { error } = await db.from("admin_costs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return done();
}

// Encerra um custo mensal (ex.: cancelou a ferramenta) a partir de hoje.
export async function endCost(id: string): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return denied;
  const db = createAdminClient();
  const { error } = await db.from("admin_costs").update({ ends_on: new Date().toISOString().slice(0, 10) }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return done();
}

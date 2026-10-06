"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/data/org";
import { getBillingState } from "@/lib/data/billing";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPlan, TRIAL_DAYS } from "@/lib/plans";

export interface BillingResult {
  ok: boolean;
  url?: string;
  error?: string;
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "cliva.me";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

// Abre o checkout da Stripe para o plano escolhido (7 dias grátis na 1ª vez).
export async function startCheckout(planKey: string): Promise<BillingResult> {
  if (!isStripeConfigured) return { ok: false, error: "Pagamentos ainda não configurados." };
  const plan = getPlan(planKey);
  if (!plan) return { ok: false, error: "Plano inválido." };

  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login para assinar." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para assinar." };

  const { billing } = await getBillingState(org.id);
  const stripe = getStripe();

  const prices = await stripe.prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) return { ok: false, error: "Preço do plano não encontrado na Stripe." };

  const base = await origin();
  const giveTrial = !billing?.trial_used;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      allow_promotion_codes: true, // campo de cupom (ex.: CLIVA10)
      locale: "pt-BR",
      client_reference_id: org.id,
      ...(billing?.stripe_customer_id
        ? { customer: billing.stripe_customer_id }
        : { customer_email: user.email ?? undefined }),
      metadata: { org_id: org.id, plan: plan.key },
      subscription_data: {
        metadata: { org_id: org.id, plan: plan.key },
        ...(giveTrial ? { trial_period_days: TRIAL_DAYS } : {}),
      },
      success_url: `${base}/dashboard?assinatura=ok`,
      cancel_url: `${base}/assinar?plano=${plan.key}`,
    });
    return { ok: true, url: session.url ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao abrir o pagamento." };
  }
}

// Portal da Stripe: trocar plano, cartão, ver faturas ou cancelar.
export async function openBillingPortal(): Promise<BillingResult> {
  if (!isStripeConfigured) return { ok: false, error: "Pagamentos ainda não configurados." };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login." };
  const { billing } = await getBillingState(org.id);
  if (!billing?.stripe_customer_id) return { ok: false, error: "Nenhuma assinatura encontrada." };

  const stripe = getStripe();
  // Configuração do portal criada para a Cliva (metadata app=cliva).
  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
  const config = configs.data.find((c) => c.metadata?.app === "cliva");

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${await origin()}/settings`,
      ...(config ? { configuration: config.id } : {}),
    });
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao abrir o portal." };
  }
}

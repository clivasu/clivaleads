import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { decideBillingUpdate, type SubscriptionSnapshot } from "@/lib/billing/sync";

// Recebe os eventos da Stripe e mantém public.org_billing em dia.
// - Assinatura do webhook verificada (rejeita payload adulterado).
// - Idempotente: evento já processado é ignorado (stripe_events).
// - Fora de ordem: o estado é sempre relido da Stripe antes de gravar, então
//   um evento antigo que chega depois não sobrescreve o estado atual.

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

export async function POST(request: NextRequest) {
  if (!isStripeConfigured || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe não configurada" }, { status: 503 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature") ?? "";
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }
  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true, ignored: true });

  const supabase = createAdminClient();

  // Já processado? (retry da Stripe ou entrega duplicada)
  const { data: seen, error: seenErr } = await supabase.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });
  const dedupeAvailable = !seenErr; // tabela ausente (0011 não aplicada): segue sem dedupe

  try {
    let subId: string | null = null;
    let orgHint: string | null = null;
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "subscription" && s.subscription) {
        subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
        orgHint = s.client_reference_id ?? s.metadata?.org_id ?? null;
      }
    } else {
      subId = (event.data.object as Stripe.Subscription).id;
    }

    if (subId) {
      // Estado atual, não o do evento (cobre eventos fora de ordem).
      const sub = await stripe.subscriptions.retrieve(subId);
      await syncSubscription(supabase, sub, orgHint, event.created);
    }
  } catch (e) {
    console.error("[stripe-webhook] falha ao processar", event.type, e instanceof Error ? e.message : "erro");
    // 500 faz a Stripe tentar de novo mais tarde (o evento NÃO foi marcado).
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  if (dedupeAvailable) {
    await supabase.from("stripe_events").insert({ id: event.id, type: event.type });
  }
  return NextResponse.json({ received: true });
}

function snapshot(sub: Stripe.Subscription): SubscriptionSnapshot {
  const item = sub.items.data[0];
  return {
    id: sub.id,
    status: sub.status,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    metadataOrgId: sub.metadata?.org_id ?? null,
    metadataPlan: sub.metadata?.plan ?? null,
    priceLookupKey: item?.price?.lookup_key ?? null,
    trialEnd: sub.trial_end,
    currentPeriodEnd: item?.current_period_end ?? null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelAt: sub.cancel_at,
  };
}

async function syncSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
  orgIdHint: string | null,
  eventCreated: number,
) {
  const snap = snapshot(sub);

  // Org: metadata da assinatura > dica do checkout > cliente já conhecido.
  let orgId = snap.metadataOrgId || orgIdHint || null;
  if (!orgId) {
    const { data } = await supabase.from("org_billing").select("organization_id").eq("stripe_customer_id", snap.customerId).maybeSingle();
    orgId = data?.organization_id ?? null;
  }
  if (!orgId) return; // assinatura de fora da Cliva

  const { data: current } = await supabase
    .from("org_billing")
    .select("stripe_subscription_id, status, manual")
    .eq("organization_id", orgId)
    .maybeSingle();

  const decision = decideBillingUpdate(orgId, snap, current);
  if (decision.action === "skip") return;

  const row = { ...decision.row, stripe_event_at: new Date(eventCreated * 1000).toISOString() };
  let { error } = await supabase.from("org_billing").upsert(row, { onConflict: "organization_id" });
  // Coluna stripe_event_at ainda não existe (0011 não aplicada).
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await supabase.from("org_billing").upsert(decision.row, { onConflict: "organization_id" }));
  }
  if (error) throw new Error(error.message);
}

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { getPlan, getPlanByLookupKey } from "@/lib/plans";
import { statusHasAccess } from "@/lib/data/billing";

// Recebe os eventos da Stripe e mantém public.org_billing em dia.
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription) {
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub, s.client_reference_id ?? s.metadata?.org_id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (e) {
    // 500 faz a Stripe tentar de novo mais tarde.
    return NextResponse.json({ error: e instanceof Error ? e.message : "erro" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(sub: Stripe.Subscription, orgIdHint?: string | null) {
  const supabase = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Org: metadata da assinatura > dica do checkout > cliente já conhecido.
  let orgId = sub.metadata?.org_id || orgIdHint || null;
  if (!orgId) {
    const { data } = await supabase
      .from("org_billing")
      .select("organization_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    orgId = data?.organization_id ?? null;
  }
  if (!orgId) return; // assinatura de fora da Cliva

  // Evento de uma assinatura antiga (ex.: cancelada) não derruba a atual.
  const { data: current } = await supabase
    .from("org_billing")
    .select("stripe_subscription_id, status")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (
    current?.stripe_subscription_id &&
    current.stripe_subscription_id !== sub.id &&
    statusHasAccess(current.status) &&
    !statusHasAccess(sub.status)
  ) return;

  // Plano pelo preço atual (cobre troca de plano feita no portal).
  const item = sub.items.data[0];
  const plan =
    getPlanByLookupKey(item?.price?.lookup_key) ?? getPlan(sub.metadata?.plan) ?? null;
  const ts = (n?: number | null) => (n ? new Date(n * 1000).toISOString() : null);

  const { error } = await supabase.from("org_billing").upsert(
    {
      organization_id: orgId,
      plan: plan?.key ?? null,
      status: sub.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      trial_ends_at: ts(sub.trial_end),
      current_period_end: ts(item?.current_period_end),
      cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
      // Quem já teve assinatura não ganha outro teste grátis.
      trial_used: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) throw new Error(error.message);
}

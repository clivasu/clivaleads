import { getPlan, getPlanByLookupKey, type PlanKey } from "@/lib/plans";

// Decide como uma assinatura da Stripe atualiza org_billing. Função pura:
// testável sem Stripe nem banco (tests/unit/billing-sync.test.ts).

const ACCESS = new Set(["trialing", "active", "past_due", "legacy", "comp"]);

export interface SubscriptionSnapshot {
  id: string;
  status: string;
  customerId: string;
  metadataOrgId?: string | null;
  metadataPlan?: string | null;
  priceLookupKey?: string | null;
  trialEnd?: number | null;        // unix (s)
  currentPeriodEnd?: number | null; // unix (s)
  cancelAtPeriodEnd?: boolean;
  cancelAt?: number | null;
}

export interface CurrentBilling {
  stripe_subscription_id?: string | null;
  status?: string | null;
  manual?: boolean | null;
}

export type BillingDecision =
  | { action: "skip"; reason: "manual" | "older_subscription" }
  | { action: "upsert"; row: Record<string, unknown> };

export function decideBillingUpdate(orgId: string, sub: SubscriptionSnapshot, current: CurrentBilling | null): BillingDecision {
  // Decisão manual do admin (cortesia, bloqueio, plano) vale mais que a Stripe.
  if (current?.manual) return { action: "skip", reason: "manual" };
  // Evento de uma assinatura antiga (ex.: cancelada) não derruba a atual.
  if (
    current?.stripe_subscription_id &&
    current.stripe_subscription_id !== sub.id &&
    ACCESS.has(current.status ?? "") &&
    !ACCESS.has(sub.status)
  ) {
    return { action: "skip", reason: "older_subscription" };
  }
  const plan: PlanKey | null = getPlanByLookupKey(sub.priceLookupKey)?.key ?? getPlan(sub.metadataPlan)?.key ?? null;
  const ts = (n?: number | null) => (n ? new Date(n * 1000).toISOString() : null);
  return {
    action: "upsert",
    row: {
      organization_id: orgId,
      plan,
      status: sub.status,
      stripe_customer_id: sub.customerId,
      stripe_subscription_id: sub.id,
      trial_ends_at: ts(sub.trialEnd),
      current_period_end: ts(sub.currentPeriodEnd),
      cancel_at_period_end: Boolean(sub.cancelAtPeriodEnd || sub.cancelAt),
      // Quem já teve assinatura não ganha outro teste grátis.
      trial_used: true,
      updated_at: new Date().toISOString(),
    },
  };
}

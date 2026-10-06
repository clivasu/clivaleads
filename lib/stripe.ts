import "server-only";
import Stripe from "stripe";

// STRIPE_SECRET_KEY aceita chave da conta (sk_/rk_) ou da organização
// (sk_org_). Com chave de organização, STRIPE_ACCOUNT_ID diz qual conta usar.
const SECRET = process.env.STRIPE_SECRET_KEY ?? "";
const ACCOUNT = process.env.STRIPE_ACCOUNT_ID ?? "";

export const isStripeConfigured = SECRET.length > 0;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeConfigured) throw new Error("Stripe não configurada (STRIPE_SECRET_KEY).");
  if (!client) {
    client = new Stripe(SECRET, {
      ...(ACCOUNT ? { stripeContext: ACCOUNT } : {}),
      appInfo: { name: "Cliva" },
    });
  }
  return client;
}

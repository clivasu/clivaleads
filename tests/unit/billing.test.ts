import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { decideBillingUpdate, type SubscriptionSnapshot } from "@/lib/billing/sync";

const ORG = "11111111-1111-4111-8111-111111111111";
const base: SubscriptionSnapshot = { id: "sub_novo", status: "active", customerId: "cus_1", priceLookupKey: "cliva_pro_mensal", currentPeriodEnd: 1_900_000_000 };

describe("2.5 decisão de sincronização da assinatura", () => {
  it("assinatura ativa grava plano pelo preço atual", () => {
    const d = decideBillingUpdate(ORG, base, null);
    expect(d.action).toBe("upsert");
    if (d.action === "upsert") expect(d.row).toMatchObject({ plan: "pro", status: "active", trial_used: true, stripe_subscription_id: "sub_novo" });
  });
  it("troca de plano no portal muda o plano (lookup_key vence a metadata)", () => {
    const d = decideBillingUpdate(ORG, { ...base, priceLookupKey: "cliva_elite_mensal", metadataPlan: "pro" }, { stripe_subscription_id: "sub_novo", status: "active" });
    if (d.action === "upsert") expect(d.row.plan).toBe("elite");
  });
  it("cortesia/bloqueio manual do admin não é sobrescrito pela Stripe", () => {
    expect(decideBillingUpdate(ORG, base, { manual: true, status: "comp" })).toEqual({ action: "skip", reason: "manual" });
  });
  it("cancelamento de uma assinatura antiga não derruba a atual", () => {
    const d = decideBillingUpdate(ORG, { ...base, id: "sub_antiga", status: "canceled" }, { stripe_subscription_id: "sub_novo", status: "active" });
    expect(d).toEqual({ action: "skip", reason: "older_subscription" });
  });
  it("cancelamento da própria assinatura atual é aplicado", () => {
    const d = decideBillingUpdate(ORG, { ...base, status: "canceled" }, { stripe_subscription_id: "sub_novo", status: "active" });
    if (d.action === "upsert") expect(d.row.status).toBe("canceled");
  });
  it("cancelamento agendado fica marcado", () => {
    const d = decideBillingUpdate(ORG, { ...base, cancelAtPeriodEnd: true }, null);
    if (d.action === "upsert") expect(d.row.cancel_at_period_end).toBe(true);
  });
});

describe("2.5 webhook da Stripe: assinatura do payload", () => {
  async function loadRoute() {
    vi.resetModules();
    process.env.STRIPE_SECRET_KEY = "sk_test_cliva";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_teste_cliva";
    return import("@/app/api/stripe/webhook/route");
  }
  const req = (body: string, sig: string) =>
    new Request("http://localhost/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": sig } });

  it("rejeita payload sem assinatura válida", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify({ id: "evt_1", object: "event", type: "customer.subscription.updated", data: { object: {} } });
    const res = await POST(req(body, "t=1,v1=falsa") as never);
    expect(res.status).toBe(400);
  });
  it("rejeita payload adulterado depois de assinado", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify({ id: "evt_2", object: "event", type: "invoice.created", data: { object: {} } });
    const sig = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_teste_cliva" });
    const res = await POST(req(body.replace("evt_2", "evt_X"), sig) as never);
    expect(res.status).toBe(400);
  });
  it("aceita evento assinado (tipo não tratado é ignorado sem tocar no banco)", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify({ id: "evt_3", object: "event", type: "invoice.created", created: 1, data: { object: {} } });
    const sig = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_teste_cliva" });
    const res = await POST(req(body, sig) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, ignored: true });
  });
});

describe("2.5 origem canônica", () => {
  it("em produção ignora valores fora da lista e usa cliva.me", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site-do-atacante.com");
    const { siteUrl } = await import("@/lib/site-url");
    expect(siteUrl()).toBe("https://cliva.me");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://cliva.me/");
    expect(siteUrl()).toBe("https://cliva.me");
    vi.unstubAllEnvs();
  });
});

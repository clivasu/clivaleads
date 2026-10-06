// Cria (ou confere) na Stripe tudo que a cobrança da Cliva precisa:
// produtos + preços mensais, cupom CLIVA10, portal do cliente e webhook.
// Pode rodar mais de uma vez: o que já existe é reaproveitado.
//
// Uso:
//   STRIPE_SECRET_KEY=... [STRIPE_ACCOUNT_ID=acct_...] \
//   WEBHOOK_URL=https://cliva.me/api/stripe/webhook \
//   WEBHOOK_SECRET_FILE=/caminho/seguro/whsec.txt \
//   node scripts/stripe-setup.mjs
import Stripe from "stripe";
import { writeFileSync } from "node:fs";

const PLANS = [
  { key: "inicial", name: "Cliva Inicial", cents: 4990, lookup: "cliva_inicial_mensal", desc: "1 funil publicado e até 1 mil leads por mês." },
  { key: "essencial", name: "Cliva Essencial", cents: 8990, lookup: "cliva_essencial_mensal", desc: "Até 2 funis e 5 mil leads por mês." },
  { key: "pro", name: "Cliva Pro", cents: 14700, lookup: "cliva_pro_mensal", desc: "Até 5 funis, 10 mil leads por mês e webhook/CRM." },
  { key: "elite", name: "Cliva Elite", cents: 29700, lookup: "cliva_elite_mensal", desc: "Até 10 funis, 25 mil leads por mês, webhook/CRM e equipe." },
];
const COUPON_ID = "CLIVA10";
const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
];

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("Defina STRIPE_SECRET_KEY");
const stripe = new Stripe(key, process.env.STRIPE_ACCOUNT_ID ? { stripeContext: process.env.STRIPE_ACCOUNT_ID } : {});

const log = (...a) => console.log("•", ...a);

// 1) Produtos e preços -------------------------------------------------------
const prices = {};
for (const p of PLANS) {
  const found = (await stripe.prices.list({ lookup_keys: [p.lookup], active: true, limit: 1, expand: ["data.product"] })).data[0];
  if (found && found.unit_amount === p.cents && found.currency === "brl") {
    prices[p.key] = found;
    log(`${p.name}: preço já existe (${found.id})`);
    continue;
  }
  let product = found?.product && typeof found.product === "object" ? found.product : null;
  if (!product) {
    const search = await stripe.products.search({ query: `metadata['cliva_plan']:'${p.key}' AND active:'true'` });
    product = search.data[0] ?? await stripe.products.create({
      name: p.name, description: p.desc, metadata: { app: "cliva", cliva_plan: p.key },
    });
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "brl",
    unit_amount: p.cents,
    recurring: { interval: "month" },
    lookup_key: p.lookup,
    transfer_lookup_key: true, // se já havia preço antigo com esse lookup, ele passa para o novo
    nickname: `${p.name} mensal`,
    metadata: { app: "cliva", cliva_plan: p.key },
  });
  if (found) await stripe.prices.update(found.id, { active: false });
  prices[p.key] = { ...price, product };
  log(`${p.name}: preço criado R$ ${(p.cents / 100).toFixed(2)} (${price.id})`);
}
const productIds = PLANS.map((p) => (typeof prices[p.key].product === "string" ? prices[p.key].product : prices[p.key].product.id));

// 2) Cupom CLIVA10: 10% por 2 meses, só na primeira compra -------------------
let coupon = await stripe.coupons.retrieve(COUPON_ID).catch(() => null);
if (!coupon) {
  coupon = await stripe.coupons.create({
    id: COUPON_ID,
    name: "CLIVA10 · 10% por 2 meses",
    percent_off: 10,
    duration: "repeating",
    duration_in_months: 2,
    applies_to: { products: productIds },
    metadata: { app: "cliva" },
  });
  log("Cupom CLIVA10 criado");
} else log("Cupom CLIVA10 já existe");

const promo = (await stripe.promotionCodes.list({ code: COUPON_ID, active: true, limit: 1 })).data[0];
if (!promo) {
  await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: COUPON_ID },
    code: COUPON_ID,
    restrictions: { first_time_transaction: true },
    metadata: { app: "cliva" },
  });
  log("Código promocional CLIVA10 criado (só primeira compra)");
} else log("Código promocional CLIVA10 já existe");

// 3) Portal do cliente (trocar plano, cartão, faturas, cancelar) -------------
const portalFeatures = {
  customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: {
    enabled: true, mode: "at_period_end",
    cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] },
  },
  subscription_update: {
    enabled: true,
    default_allowed_updates: ["price"],
    proration_behavior: "create_prorations",
    products: PLANS.map((p, i) => ({ product: productIds[i], prices: [prices[p.key].id] })),
  },
};
const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 50 });
const existing = configs.data.find((c) => c.metadata?.app === "cliva");
const portalBase = {
  business_profile: { headline: "Gerencie sua assinatura da Cliva" },
  features: portalFeatures,
  default_return_url: process.env.PORTAL_RETURN_URL ?? "https://cliva.me/settings",
  metadata: { app: "cliva" },
};
if (existing) {
  await stripe.billingPortal.configurations.update(existing.id, portalBase);
  log(`Portal do cliente atualizado (${existing.id})`);
} else {
  const c = await stripe.billingPortal.configurations.create(portalBase);
  log(`Portal do cliente criado (${c.id})`);
}

// 4) Webhook ------------------------------------------------------------------
const url = process.env.WEBHOOK_URL;
if (url) {
  const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
  const hook = hooks.data.find((h) => h.url === url);
  if (hook) {
    await stripe.webhookEndpoints.update(hook.id, { enabled_events: EVENTS });
    log(`Webhook já existe (${hook.id}); eventos atualizados. O segredo não muda.`);
  } else {
    const h = await stripe.webhookEndpoints.create({ url, enabled_events: EVENTS, description: "Cliva: assinaturas", metadata: { app: "cliva" } });
    if (process.env.WEBHOOK_SECRET_FILE) {
      writeFileSync(process.env.WEBHOOK_SECRET_FILE, h.secret, { mode: 0o600 });
      log(`Webhook criado (${h.id}); segredo salvo em WEBHOOK_SECRET_FILE`);
    } else {
      log(`Webhook criado (${h.id}). Copie o segredo no painel da Stripe.`);
    }
  }
}

log("Pronto.");

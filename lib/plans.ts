// Catálogo de planos da Cliva. Usado na landing, na página de assinatura,
// nos limites do app e na criação dos preços na Stripe (via lookup_key).

export type PlanKey = "inicial" | "essencial" | "pro" | "elite";

export interface Plan {
  key: PlanKey;
  name: string;
  priceCents: number; // BRL, mensal
  desc: string;
  funnels: number;      // funis publicados ao mesmo tempo
  leadsPerMonth: number;
  webhook: boolean;
  team: boolean;
  highlight?: boolean;
  lookupKey: string;    // preço na Stripe
}

export const PLANS: Plan[] = [
  {
    key: "inicial", name: "Inicial", priceCents: 4990, lookupKey: "cliva_inicial_mensal",
    desc: "Para dar o primeiro passo com um funil.",
    funnels: 1, leadsPerMonth: 1000, webhook: false, team: false,
  },
  {
    key: "essencial", name: "Essencial", priceCents: 8990, lookupKey: "cliva_essencial_mensal",
    desc: "Para começar a lotar a agenda com tranquilidade.",
    funnels: 2, leadsPerMonth: 5000, webhook: false, team: false,
  },
  {
    key: "pro", name: "Pro", priceCents: 14700, lookupKey: "cliva_pro_mensal", highlight: true,
    desc: "Para quem já anuncia e quer performance.",
    funnels: 5, leadsPerMonth: 10000, webhook: true, team: false,
  },
  {
    key: "elite", name: "Elite", priceCents: 29700, lookupKey: "cliva_elite_mensal",
    desc: "Para escala e para quem atende várias clínicas.",
    funnels: 10, leadsPerMonth: 25000, webhook: true, team: true,
  },
];

export const TRIAL_DAYS = 7;
export const COUPON_CODE = "CLIVA10";

export function getPlan(key?: string | null): Plan | undefined {
  return PLANS.find((p) => p.key === key);
}

export function getPlanByLookupKey(lookupKey?: string | null): Plan | undefined {
  return PLANS.find((p) => p.lookupKey === lookupKey);
}

// "49,90" / "147"
export function formatPrice(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  return centavos ? `${reais},${String(centavos).padStart(2, "0")}` : String(reais);
}

export function formatLeads(n: number): string {
  return n >= 1000 ? `${n / 1000} mil` : String(n);
}

export function planLimits(plan: Plan): [string, boolean][] {
  return [
    [plan.funnels === 1 ? "1 funil publicado" : `Até ${plan.funnels} funis`, true],
    [`Até ${formatLeads(plan.leadsPerMonth)} leads/mês`, true],
    ["Webhook / CRM", plan.webhook],
    ["Edição em equipe", plan.team],
  ];
}

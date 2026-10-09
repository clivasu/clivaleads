import type { AdminDashboard } from "@/lib/data/admin-metrics";

// Vitrine do admin no modo demonstração (sem Supabase). Números inventados.
const MONTHS = ["nov/25", "dez/25", "jan/26", "fev/26", "mar/26", "abr/26", "mai/26", "jun/26", "jul/26", "ago/26", "set/26", "out/26"];

export function demoAdminDashboard(): AdminDashboard {
  const mrrSeries = MONTHS.map((label, i) => ({ label, mrr: Math.round([0, 0, 4990, 13980, 23870, 31860, 45550, 52440, 66130, 78020, 92610, 104500][i]) }));
  const movement = MONTHS.map((label, i) => ({ label, novos: [0, 0, 1, 2, 2, 2, 3, 2, 3, 3, 4, 3][i], cancelados: [0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0][i] }));
  const receitas = [0, 0, 4990, 13980, 23870, 31860, 45550, 52440, 66130, 78020, 92610, 61200];
  const custos = [12000, 12000, 15500, 15500, 22500, 22500, 32500, 32500, 32500, 42500, 42500, 42500];
  let acumulado = 0;
  const finance = MONTHS.map((label, i) => {
    const taxas = Math.round(receitas[i] * 0.045);
    const resultado = receitas[i] - taxas - custos[i];
    acumulado += resultado;
    return { label, receita: receitas[i], taxas, custos: custos[i], resultado, acumulado };
  });
  const signupsDaily = Array.from({ length: 30 }, (_, i) => ({ label: `${String(((i + 10) % 30) + 1).padStart(2, "0")}/${i < 20 ? "09" : "10"}`, cadastros: [0, 1, 0, 2, 1, 0, 0, 3, 1, 1, 2, 0, 1, 4, 2, 1, 0, 1, 2, 3, 1, 0, 2, 5, 2, 1, 3, 2, 4, 3][i] }));
  const now = new Date().toISOString();
  return {
    billingOk: true, costsOk: true, stripeOk: true,
    kpis: {
      mrr: 104500, arr: 1254000, payers: 11, arpu: 9500, trialing: 4, trialMrr: 41380, comp: 3, compValue: 44400,
      pastDue: 1, blocked: 1, newPaying30: 3, churned30: 0, churnRate30: 0, signups30: 48, signupsPrev30: 31,
      revenueMonth: 61200, revenuePrevMonth: 92610, revenue12: receitas.reduce((a, b) => a + b, 0),
      conversionRate: 0.62, accounts: 21, mrrPrevMonth: 92610,
    },
    mrrSeries, movement, signupsDaily,
    planMix: [
      { plan: "Inicial", pagantes: 4, teste: 2, cortesia: 0 },
      { plan: "Essencial", pagantes: 3, teste: 1, cortesia: 1 },
      { plan: "Pro", pagantes: 3, teste: 1, cortesia: 2 },
      { plan: "Elite", pagantes: 1, teste: 0, cortesia: 0 },
    ],
    statusMix: [
      { status: "active", label: "Pagando", count: 11 }, { status: "trialing", label: "Em teste", count: 4 },
      { status: "comp", label: "Cortesia", count: 3 }, { status: "past_due", label: "Pagamento pendente", count: 1 },
      { status: "none", label: "Sem plano", count: 1 }, { status: "blocked", label: "Bloqueada", count: 1 },
    ],
    finance,
    costs: [
      { id: "c1", description: "Supabase Pro", category: "infra", amount_cents: 14000, kind: "monthly", starts_on: "2026-01-01", ends_on: null },
      { id: "c2", description: "Vercel Pro", category: "infra", amount_cents: 11000, kind: "monthly", starts_on: "2026-01-01", ends_on: null },
      { id: "c3", description: "Anúncios Meta", category: "marketing", amount_cents: 15000, kind: "monthly", starts_on: "2026-03-01", ends_on: null },
      { id: "c4", description: "Domínio cliva.me", category: "infra", amount_cents: 9900, kind: "once", starts_on: "2026-10-05", ends_on: null },
    ],
    costsThisMonth: 40000, ticketRef: 9500, ticketIsEstimate: false, breakEvenCustomers: 5, cac: 13200, paybackMonths: 1.4,
    accountsList: [
      { id: "a1", name: "Drª Bárbara", slug: "drabarbara", email: "barbara@exemplo.com", created_at: now, flows: 3, leads: 7, plan: "pro", status: "active", manual: false, admin_note: null, mrrCents: 14700, hasStripeSub: true, cancelAtPeriodEnd: false, trialEndsAt: null },
      { id: "a2", name: "Clínica Vida", slug: "clinica-vida", email: "contato@vida.com", created_at: now, flows: 1, leads: 2, plan: "inicial", status: "trialing", manual: false, admin_note: null, mrrCents: 0, hasStripeSub: true, cancelAtPeriodEnd: false, trialEndsAt: now },
      { id: "a3", name: "Amigo do Marco", slug: "amigo", email: "amigo@exemplo.com", created_at: now, flows: 2, leads: 5, plan: "elite", status: "comp", manual: true, admin_note: "amigo, liberado até dezembro", mrrCents: 0, hasStripeSub: false, cancelAtPeriodEnd: false, trialEndsAt: null },
      { id: "a4", name: "Estética Bella", slug: "bella", email: "bella@exemplo.com", created_at: now, flows: 4, leads: 31, plan: "essencial", status: "past_due", manual: false, admin_note: null, mrrCents: 8990, hasStripeSub: true, cancelAtPeriodEnd: false, trialEndsAt: null },
      { id: "a5", name: "Conta suspeita", slug: "spam", email: "x@spam.com", created_at: now, flows: 0, leads: 0, plan: null, status: "blocked", manual: true, admin_note: "spam", mrrCents: 0, hasStripeSub: false, cancelAtPeriodEnd: false, trialEndsAt: null },
    ],
  };
}

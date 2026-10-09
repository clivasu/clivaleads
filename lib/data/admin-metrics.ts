import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { PLANS, getPlan, getPlanByLookupKey, type PlanKey } from "@/lib/plans";

// Métricas do admin geral: MRR, assinantes, receita, custos e contas.
// Tudo em centavos (BRL). Meses no fuso de Brasília (UTC-3, sem horário de verão).

const BR_OFFSET_MS = 3 * 60 * 60 * 1000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export type AccountStatus =
  | "active" | "trialing" | "past_due" | "comp" | "legacy" | "blocked" | "canceled" | "none" | string;

export interface AccountRow {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  created_at: string;
  flows: number;
  leads: number;
  plan: PlanKey | null;
  status: AccountStatus;
  manual: boolean;
  admin_note: string | null;
  mrrCents: number;            // quanto paga por mês hoje (0 em teste/cortesia)
  hasStripeSub: boolean;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

export interface CostRow {
  id: string;
  description: string;
  category: string;
  amount_cents: number;
  kind: "monthly" | "once";
  starts_on: string;
  ends_on: string | null;
}

export interface AdminDashboard {
  billingOk: boolean;
  costsOk: boolean;
  stripeOk: boolean;
  stripeError?: string;
  kpis: {
    mrr: number; arr: number; payers: number; arpu: number;
    trialing: number; trialMrr: number;
    comp: number; compValue: number;
    pastDue: number; blocked: number;
    newPaying30: number; churned30: number; churnRate30: number | null;
    signups30: number; signupsPrev30: number;
    revenueMonth: number; revenuePrevMonth: number; revenue12: number;
    conversionRate: number | null;
    accounts: number;
    mrrPrevMonth: number;
  };
  mrrSeries: { label: string; mrr: number }[];
  movement: { label: string; novos: number; cancelados: number }[];
  signupsDaily: { label: string; cadastros: number }[];
  planMix: { plan: string; pagantes: number; teste: number; cortesia: number }[];
  statusMix: { status: string; label: string; count: number }[];
  finance: { label: string; receita: number; taxas: number; custos: number; resultado: number; acumulado: number }[];
  costs: CostRow[];
  costsThisMonth: number;
  ticketRef: number;
  ticketIsEstimate: boolean;
  breakEvenCustomers: number | null;
  cac: number | null;
  paybackMonths: number | null;
  accountsList: AccountRow[];
}

/* ------------------------------- datas ------------------------------- */
const brDate = (ms: number) => new Date(ms - BR_OFFSET_MS); // "relógio" de Brasília em campos UTC
function monthKey(ms: number) {
  const d = brDate(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function lastMonths(n: number, now: number) {
  const d = brDate(now);
  const out: { key: string; label: string; start: number; end: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() - i;
    const startBR = Date.UTC(y, m, 1);
    const endBR = Date.UTC(y, m + 1, 1);
    const sd = new Date(startBR);
    out.push({
      key: `${sd.getUTCFullYear()}-${String(sd.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[sd.getUTCMonth()]}/${String(sd.getUTCFullYear()).slice(2)}`,
      start: startBR + BR_OFFSET_MS,
      end: endBR + BR_OFFSET_MS,
    });
  }
  return out;
}

/* ------------------------------- Stripe ------------------------------ */
interface SubLite {
  orgId: string | null;
  plan: PlanKey | null;
  status: string;
  monthly: number;          // centavos/mês
  paidStart: number | null; // ms em que começou a pagar (fim do teste)
  end: number | null;       // ms em que terminou
  trialEnd: number | null;
}

function monthlyAmount(sub: Stripe.Subscription): number {
  let total = 0;
  for (const it of sub.items.data) {
    const unit = it.price?.unit_amount ?? 0;
    const r = it.price?.recurring;
    const perMonth = !r ? unit : r.interval === "year" ? unit / (12 * r.interval_count) : r.interval === "week" ? (unit * 52) / (12 * r.interval_count) : unit / r.interval_count;
    total += perMonth * (it.quantity ?? 1);
  }
  return Math.round(total);
}

async function loadStripe(since: number) {
  const stripe = getStripe();
  const subs: SubLite[] = [];
  for await (const s of stripe.subscriptions.list({ status: "all", limit: 100 })) {
    const ms = (n?: number | null) => (n ? n * 1000 : null);
    const trialEnd = ms(s.trial_end);
    const start = ms(s.start_date) ?? ms(s.created) ?? Date.now();
    const end = ms(s.ended_at) ?? (s.status === "canceled" ? ms(s.canceled_at) : null);
    const paidStart = trialEnd && trialEnd > start ? trialEnd : start;
    const neverPaid = s.status === "incomplete" || s.status === "incomplete_expired" || (end !== null && trialEnd !== null && end <= trialEnd + 60_000);
    subs.push({
      orgId: s.metadata?.org_id ?? null,
      plan: getPlanByLookupKey(s.items.data[0]?.price?.lookup_key)?.key ?? getPlan(s.metadata?.plan)?.key ?? null,
      status: s.status,
      monthly: monthlyAmount(s),
      paidStart: neverPaid ? null : paidStart,
      end,
      trialEnd,
    });
    if (subs.length >= 3000) break;
  }

  const invoices: { at: number; amount: number }[] = [];
  for await (const inv of stripe.invoices.list({ status: "paid", created: { gte: Math.floor(since / 1000) }, limit: 100 })) {
    if (!inv.amount_paid) continue;
    invoices.push({ at: (inv.status_transitions?.paid_at ?? inv.created) * 1000, amount: inv.amount_paid });
    if (invoices.length >= 5000) break;
  }

  // Taxas reais da Stripe (se a chave tiver permissão de saldo).
  const fees: { at: number; amount: number }[] = [];
  try {
    for await (const bt of stripe.balanceTransactions.list({ created: { gte: Math.floor(since / 1000) }, limit: 100 })) {
      if (bt.fee) fees.push({ at: bt.created * 1000, amount: bt.fee });
      if (fees.length >= 5000) break;
    }
  } catch { /* sem permissão: segue sem taxas */ }

  return { subs, invoices, fees };
}

/* ------------------------------- montagem ---------------------------- */
const STATUS_LABEL: Record<string, string> = {
  active: "Pagando", trialing: "Em teste", past_due: "Pagamento pendente", comp: "Cortesia",
  legacy: "Cortesia (antiga)", blocked: "Bloqueada", canceled: "Cancelada", none: "Sem plano",
  unpaid: "Não paga", incomplete: "Aguardando pagamento", incomplete_expired: "Pagamento expirado", paused: "Pausada",
};
export const accountStatusLabel = (s: string) => STATUS_LABEL[s] ?? s;

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const now = Date.now();
  const months = lastMonths(12, now);
  const since = months[0].start;

  const empty: AdminDashboard = {
    billingOk: false, costsOk: false, stripeOk: false,
    kpis: { mrr: 0, arr: 0, payers: 0, arpu: 0, trialing: 0, trialMrr: 0, comp: 0, compValue: 0, pastDue: 0, blocked: 0, newPaying30: 0, churned30: 0, churnRate30: null, signups30: 0, signupsPrev30: 0, revenueMonth: 0, revenuePrevMonth: 0, revenue12: 0, conversionRate: null, accounts: 0, mrrPrevMonth: 0 },
    mrrSeries: [], movement: [], signupsDaily: [], planMix: [], statusMix: [], finance: [], costs: [],
    costsThisMonth: 0, ticketRef: 0, ticketIsEstimate: true, breakEvenCustomers: null, cac: null, paybackMonths: null, accountsList: [],
  };
  if (!isSupabaseConfigured) return empty;

  const db = createAdminClient();
  const [orgsRes, flowsRes, leadsRes, membersRes, billingRes, costsRes] = await Promise.all([
    db.from("organizations").select("id,name,slug,created_at").order("created_at", { ascending: false }),
    db.from("flows").select("organization_id"),
    db.from("lead_sessions").select("organization_id"),
    db.from("organization_members").select("organization_id,user_id,role"),
    db.from("org_billing").select("*"),
    db.from("admin_costs").select("*").order("starts_on", { ascending: false }),
  ]);

  // E-mail do dono de cada conta.
  const emails = new Map<string, string>();
  try {
    for (let page = 1; page <= 10; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of data?.users ?? []) if (u.email) emails.set(u.id, u.email);
      if (!data || data.users.length < 1000) break;
    }
  } catch { /* segue sem e-mails */ }
  const ownerOf = new Map<string, string>();
  for (const m of membersRes.data ?? []) {
    if (!ownerOf.has(m.organization_id) || m.role === "owner") ownerOf.set(m.organization_id, m.user_id);
  }

  const count = (rows: { organization_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) map.set(r.organization_id, (map.get(r.organization_id) ?? 0) + 1);
    return map;
  };
  const flowsBy = count(flowsRes.data);
  const leadsBy = count(leadsRes.data);

  const billingOk = !billingRes.error;
  const billingBy = new Map<string, Record<string, unknown>>();
  for (const b of (billingRes.data ?? []) as Record<string, unknown>[]) billingBy.set(String(b.organization_id), b);

  // Stripe
  let stripeOk = false;
  let stripeError: string | undefined;
  let stripe: Awaited<ReturnType<typeof loadStripe>> = { subs: [], invoices: [], fees: [] };
  if (isStripeConfigured) {
    try {
      stripe = await loadStripe(since);
      stripeOk = true;
    } catch (e) {
      stripeError = e instanceof Error ? e.message : String(e);
    }
  } else {
    stripeError = "Stripe não configurada.";
  }

  /* contas */
  const accountsList: AccountRow[] = (orgsRes.data ?? []).map((o) => {
    const b = billingBy.get(o.id);
    const status = (b?.status as string | undefined) ?? (billingOk ? "none" : "legacy");
    const plan = getPlan(b?.plan as string | undefined)?.key ?? null;
    const sub = stripe.subs.find((s) => s.orgId === o.id && ["active", "past_due", "trialing"].includes(s.status));
    const paying = (status === "active" || status === "past_due") && !b?.manual;
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      email: emails.get(ownerOf.get(o.id) ?? "") ?? null,
      created_at: o.created_at,
      flows: flowsBy.get(o.id) ?? 0,
      leads: leadsBy.get(o.id) ?? 0,
      plan,
      status,
      manual: Boolean(b?.manual),
      admin_note: (b?.admin_note as string | null | undefined) ?? null,
      mrrCents: paying ? (sub?.monthly ?? getPlan(plan)?.priceCents ?? 0) : 0,
      hasStripeSub: Boolean(b?.stripe_subscription_id),
      cancelAtPeriodEnd: Boolean(b?.cancel_at_period_end),
      trialEndsAt: (b?.trial_ends_at as string | null | undefined) ?? null,
    };
  });

  /* MRR: pelo Stripe quando disponível, senão pela tabela de assinaturas */
  const activeAt = (s: SubLite, t: number) => s.paidStart !== null && s.paidStart <= t && (s.end === null || s.end > t);
  const mrrAt = (t: number) => stripe.subs.reduce((sum, s) => (activeAt(s, t) ? sum + s.monthly : sum), 0);
  const mrrNowFromTable = accountsList.reduce((s, a) => s + a.mrrCents, 0);
  const mrr = stripeOk ? mrrAt(now) : mrrNowFromTable;
  const payers = stripeOk ? stripe.subs.filter((s) => activeAt(s, now)).length : accountsList.filter((a) => a.mrrCents > 0).length;

  const mrrSeries = months.map((m) => ({ label: m.label, mrr: stripeOk ? mrrAt(Math.min(m.end - 1, now)) : 0 }));
  if (!stripeOk && mrrSeries.length) mrrSeries[mrrSeries.length - 1].mrr = mrrNowFromTable;
  const mrrPrevMonth = mrrSeries.length > 1 ? mrrSeries[mrrSeries.length - 2].mrr : 0;

  const movement = months.map((m) => ({
    label: m.label,
    novos: stripe.subs.filter((s) => s.paidStart !== null && s.paidStart >= m.start && s.paidStart < m.end && s.paidStart <= now).length,
    cancelados: stripe.subs.filter((s) => s.paidStart !== null && s.end !== null && s.end >= m.start && s.end < m.end && s.paidStart < s.end).length,
  }));

  const d30 = now - 30 * 86400000;
  const newPaying30 = stripe.subs.filter((s) => s.paidStart !== null && s.paidStart >= d30 && s.paidStart <= now).length;
  const churned30 = stripe.subs.filter((s) => s.paidStart !== null && s.end !== null && s.end >= d30 && s.end <= now && s.paidStart < s.end).length;
  const payersAt30 = stripe.subs.filter((s) => activeAt(s, d30)).length;
  const churnRate30 = payersAt30 > 0 ? churned30 / payersAt30 : null;

  const trialsEnded = stripe.subs.filter((s) => s.trialEnd !== null && s.trialEnd <= now);
  const converted = trialsEnded.filter((s) => s.paidStart !== null).length;
  const conversionRate = trialsEnded.length > 0 ? converted / trialsEnded.length : null;

  const trialingAcc = accountsList.filter((a) => a.status === "trialing");
  const compAcc = accountsList.filter((a) => a.status === "comp" || a.status === "legacy");

  /* cadastros */
  const orgTimes = (orgsRes.data ?? []).map((o) => new Date(o.created_at).getTime());
  const signupsDaily: AdminDashboard["signupsDaily"] = [];
  for (let i = 29; i >= 0; i--) {
    const dayStartBR = Date.UTC(brDate(now).getUTCFullYear(), brDate(now).getUTCMonth(), brDate(now).getUTCDate() - i);
    const start = dayStartBR + BR_OFFSET_MS;
    const d = new Date(dayStartBR);
    signupsDaily.push({
      label: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      cadastros: orgTimes.filter((t) => t >= start && t < start + 86400000).length,
    });
  }
  const signups30 = orgTimes.filter((t) => t >= d30).length;
  const signupsPrev30 = orgTimes.filter((t) => t >= d30 - 30 * 86400000 && t < d30).length;

  /* mix por plano e por status */
  const planMix = PLANS.map((p) => ({
    plan: p.name,
    pagantes: accountsList.filter((a) => a.plan === p.key && (a.status === "active" || a.status === "past_due")).length,
    teste: accountsList.filter((a) => a.plan === p.key && a.status === "trialing").length,
    cortesia: accountsList.filter((a) => a.plan === p.key && (a.status === "comp" || a.status === "legacy")).length,
  }));
  const statusOrder = ["active", "trialing", "comp", "legacy", "past_due", "none", "canceled", "blocked"];
  const statusCounts = new Map<string, number>();
  for (const a of accountsList) statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
  const rank = (s: string) => (statusOrder.includes(s) ? statusOrder.indexOf(s) : 99);
  const statusMix = [...statusCounts.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([status, c]) => ({ status, label: accountStatusLabel(status), count: c }));

  /* custos */
  const costsOk = !costsRes.error;
  const costs = ((costsRes.data ?? []) as CostRow[]);
  const costIn = (c: CostRow, mStart: number, mEnd: number) => {
    const s = new Date(`${c.starts_on}T03:00:00Z`).getTime();
    if (c.kind === "once") return s >= mStart && s < mEnd ? c.amount_cents : 0;
    const e = c.ends_on ? new Date(`${c.ends_on}T03:00:00Z`).getTime() : Infinity;
    return s < mEnd && e >= mStart ? c.amount_cents : 0;
  };

  /* finanças por mês */
  let acumulado = 0;
  const finance = months.map((m) => {
    const receita = stripe.invoices.filter((i) => i.at >= m.start && i.at < m.end).reduce((s, i) => s + i.amount, 0);
    const taxas = stripe.fees.filter((f) => f.at >= m.start && f.at < m.end).reduce((s, f) => s + f.amount, 0);
    const custos = costs.reduce((s, c) => s + costIn(c, m.start, m.end), 0);
    const resultado = receita - taxas - custos;
    acumulado += resultado;
    return { label: m.label, receita, taxas, custos, resultado, acumulado };
  });
  const cur = months[months.length - 1];
  const costsThisMonth = costs.filter((c) => c.kind === "monthly").reduce((s, c) => s + costIn(c, cur.start, cur.end), 0);

  const arpu = payers > 0 ? Math.round(mrr / payers) : 0;
  const ticketIsEstimate = arpu === 0;
  const ticketRef = arpu || Math.round(PLANS.reduce((s, p) => s + p.priceCents, 0) / PLANS.length);
  const breakEvenCustomers = costsThisMonth > 0 ? Math.ceil(costsThisMonth / ticketRef) : null;

  // CAC: custos de marketing dos últimos 3 meses ÷ novos pagantes no período.
  const last3 = months.slice(-3);
  const mkt = costs.filter((c) => c.category === "marketing").reduce((s, c) => s + last3.reduce((x, m) => x + costIn(c, m.start, m.end), 0), 0);
  const newLast3 = movement.slice(-3).reduce((s, m) => s + m.novos, 0);
  const cac = mkt > 0 && newLast3 > 0 ? Math.round(mkt / newLast3) : null;
  const paybackMonths = cac !== null && arpu > 0 ? cac / arpu : null;

  return {
    billingOk, costsOk, stripeOk, stripeError,
    kpis: {
      mrr, arr: mrr * 12, payers, arpu,
      trialing: trialingAcc.length,
      trialMrr: trialingAcc.reduce((s, a) => s + (getPlan(a.plan)?.priceCents ?? 0), 0),
      comp: compAcc.length,
      compValue: compAcc.reduce((s, a) => s + (getPlan(a.plan)?.priceCents ?? 0), 0),
      pastDue: accountsList.filter((a) => a.status === "past_due").length,
      blocked: accountsList.filter((a) => a.status === "blocked").length,
      newPaying30, churned30, churnRate30,
      signups30, signupsPrev30,
      revenueMonth: finance[finance.length - 1]?.receita ?? 0,
      revenuePrevMonth: finance[finance.length - 2]?.receita ?? 0,
      revenue12: finance.reduce((s, f) => s + f.receita, 0),
      conversionRate,
      accounts: accountsList.length,
      mrrPrevMonth,
    },
    mrrSeries, movement, signupsDaily, planMix, statusMix, finance,
    costs, costsThisMonth, ticketRef, ticketIsEstimate, breakEvenCustomers, cac, paybackMonths,
    accountsList,
  };
}

export { monthKey };

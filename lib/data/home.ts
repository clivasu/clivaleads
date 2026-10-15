import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  appointmentStats, kpis as demoKpis, recentPatients as demoRecent,
  todayAppointments as demoToday, type KpiCard,
} from "@/lib/demo-dashboard";
import type { DashBucket, DashPeriod } from "@/lib/dashboard-period";

// Dashboard (página inicial) calculado pela agenda: função dashboard_home
// (migration 0016). Receita = preço dos atendimentos concluídos.

export type HomeStatus = "confirmed" | "waiting" | "cancelled" | "done" | "in_progress";
export interface HomeToday { id: string; doctor: string; specialty: string; patient: string; tag: string; time: string; status: HomeStatus }
export interface HomeRecent { name: string; condition: string; date: string }
export interface SeriesPoint { bucket: string; revenue: number | null; done: number | null }
export interface HomeData {
  kpis: KpiCard[];
  series: SeriesPoint[];   // faturamento × atendimentos por dia/mês/ano
  bucket: DashBucket;
  totals: { revenue: number; done: number };
  donut: { total: number; segments: { label: string; value: number; color: string }[] };
  today: HomeToday[];
  recent: HomeRecent[];
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function trend(cur: number, prev: number): { trend: string; trendUp: boolean } {
  if (!prev) return { trend: cur > 0 ? "novo" : "0%", trendUp: cur > 0 };
  const t = Math.round(((cur - prev) / prev) * 100);
  return { trend: `${t >= 0 ? "+" : ""}${t}%`, trendUp: t >= 0 };
}

const SEGMENT_COLORS = { done: "#34d399", upcoming: "#a3e635", cancelled: "#fb7185" };

function emptyHome(): HomeData {
  return {
    kpis: [
      { key: "patients", title: "Pacientes atendidos", value: "0", subtitle: "Este mês", trend: "0%", trendUp: false },
      { key: "appointments", title: "Agendamentos", value: "0", subtitle: "Este mês", trend: "0%", trendUp: false },
      { key: "revenue", title: "Receita Mensal", value: "R$ 0", subtitle: "Atendimentos concluídos", trend: "0%", trendUp: false },
      { key: "doctors", title: "Profissionais Ativos", value: "0", subtitle: "Cadastre na Agenda", trend: "", trendUp: false },
    ],
    series: [], bucket: "day", totals: { revenue: 0, done: 0 },
    donut: { total: 0, segments: [
      { label: "Concluídos", value: 0, color: SEGMENT_COLORS.done },
      { label: "Próximos", value: 0, color: SEGMENT_COLORS.upcoming },
      { label: "Cancelados", value: 0, color: SEGMENT_COLORS.cancelled },
    ] },
    today: [],
    recent: [],
  };
}

// Vitrine sem banco: série inventada no período escolhido.
function demoHome(p: DashPeriod): HomeData {
  const series: SeriesPoint[] = [];
  const from = new Date(`${p.de}T12:00:00Z`), to = new Date(`${p.ate}T12:00:00Z`);
  const today = new Date();
  for (let d = new Date(from), i = 0; d <= to; i++) {
    const done = p.bucket === "day" ? (d.getUTCDay() === 0 ? 0 : 7 + (i % 3)) : p.bucket === "month" ? 190 + (i % 4) * 8 : 2300;
    const future = d > today;
    series.push({ bucket: d.toISOString().slice(0, 10), revenue: future ? null : done * 276, done: future ? null : done });
    if (p.bucket === "day") d.setUTCDate(d.getUTCDate() + 1);
    else if (p.bucket === "month") d.setUTCMonth(d.getUTCMonth() + 1, 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1, 0, 1);
  }
  return {
    kpis: demoKpis,
    series, bucket: p.bucket,
    totals: { revenue: series.reduce((a, x) => a + (x.revenue ?? 0), 0), done: series.reduce((a, x) => a + (x.done ?? 0), 0) },
    donut: appointmentStats,
    today: demoToday.map((t, i) => ({ id: String(i), doctor: t.doctor, specialty: t.specialty, patient: t.patient, tag: t.patientId, time: t.time, status: t.status })),
    recent: demoRecent.map((r) => ({ name: r.name, condition: r.condition, date: r.date })),
  };
}

interface Raw {
  kpis: { patients: number; patients_prev: number; appointments: number; appointments_prev: number; revenue_cents: number; revenue_prev_cents: number; professionals: number };
  months: { month: string; revenue_cents: number }[];
  donut: { done: number; upcoming: number; cancelled: number };
  today: { id: string; professional: string; patient: string; procedure: string; time: string; status: string; is_return: boolean }[];
  recent: { name: string; procedure: string; date: string }[];
}

interface RawPeriod {
  kpis: { patients: number; patients_prev: number; appointments: number; appointments_prev: number; revenue_cents: number; revenue_prev_cents: number; scheduled: number; professionals: number };
  series: { bucket: string; revenue_cents: number | null; done: number | null }[];
  donut: { done: number; upcoming: number; cancelled: number };
}

function donutOf(d: { done: number; upcoming: number; cancelled: number }): HomeData["donut"] {
  return {
    total: d.done + d.upcoming + d.cancelled,
    segments: [
      { label: "Concluídos", value: d.done, color: SEGMENT_COLORS.done },
      { label: "Próximos", value: d.upcoming, color: SEGMENT_COLORS.upcoming },
      { label: "Cancelados", value: d.cancelled, color: SEGMENT_COLORS.cancelled },
    ],
  };
}

export async function getHomeData(orgId: string, period: DashPeriod): Promise<HomeData> {
  if (!isSupabaseConfigured) return demoHome(period);
  const supabase = await createClient();
  const [home, per] = await Promise.all([
    supabase.rpc("dashboard_home", { p_org: orgId }),
    supabase.rpc("dashboard_period", { p_org: orgId, p_from: period.from, p_to: period.to, p_bucket: period.bucket }),
  ]);
  if (home.error || !home.data) return emptyHome(); // banco sem a 0016: mantém os zeros
  const r = home.data as Raw;
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const base = {
    today: r.today.map((t) => ({
      id: t.id, doctor: t.professional, specialty: t.procedure, patient: t.patient, tag: t.is_return ? "Retorno" : "Primeira vez", time: t.time,
      status: (t.status === "done" ? "done" : t.status === "in_progress" ? "in_progress" : t.status === "cancelled" ? "cancelled" : t.status === "confirmed" ? "confirmed" : "waiting") as HomeStatus,
    })),
    recent: r.recent.map((p) => ({ name: p.name, condition: p.procedure, date: fmtDay(p.date) })),
  };

  // Banco sem a 0017: mostra o mês atual (visão da 0016).
  if (per.error || !per.data) {
    const k = r.kpis;
    return {
      ...base,
      kpis: buildKpis(k.patients, k.patients_prev, k.appointments, k.appointments_prev, k.revenue_cents, k.revenue_prev_cents, k.professionals, "Este mês"),
      series: r.months.map((m) => ({ bucket: `${m.month}-01`, revenue: m.revenue_cents / 100, done: null })),
      bucket: "month",
      totals: { revenue: r.months.reduce((a, m) => a + m.revenue_cents, 0) / 100, done: 0 },
      donut: donutOf(r.donut),
    };
  }
  const p = per.data as RawPeriod;
  const k = p.kpis;
  const series = p.series.map((x) => ({ bucket: x.bucket, revenue: x.revenue_cents === null ? null : x.revenue_cents / 100, done: x.done }));
  return {
    ...base,
    kpis: buildKpis(k.patients, k.patients_prev, k.appointments, k.appointments_prev, k.revenue_cents, k.revenue_prev_cents, k.professionals, period.label),
    series, bucket: period.bucket,
    totals: { revenue: k.revenue_cents / 100, done: k.appointments },
    donut: donutOf(p.donut),
  };
}

function buildKpis(pat: number, patPrev: number, appts: number, apptsPrev: number, rev: number, revPrev: number, profs: number, label: string): KpiCard[] {
  return [
    { key: "patients", title: "Pacientes atendidos", value: pat.toLocaleString("pt-BR"), subtitle: label, ...trend(pat, patPrev) },
    { key: "appointments", title: "Atendimentos", value: appts.toLocaleString("pt-BR"), subtitle: label, ...trend(appts, apptsPrev) },
    { key: "revenue", title: "Faturamento", value: brl(rev), subtitle: label, ...trend(rev, revPrev) },
    { key: "doctors", title: "Profissionais Ativos", value: String(profs), subtitle: profs ? "Na agenda" : "Cadastre na Agenda", trend: "", trendUp: false },
  ];
}

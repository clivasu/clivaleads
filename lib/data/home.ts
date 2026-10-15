import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  appointmentStats, kpis as demoKpis, recentPatients as demoRecent, revenueLabels, revenueRanges,
  todayAppointments as demoToday, type KpiCard,
} from "@/lib/demo-dashboard";

// Dashboard (página inicial) calculado pela agenda: função dashboard_home
// (migration 0016). Receita = preço dos atendimentos concluídos.

export type HomeStatus = "confirmed" | "waiting" | "cancelled" | "done" | "in_progress";
export interface HomeToday { id: string; doctor: string; specialty: string; patient: string; tag: string; time: string; status: HomeStatus }
export interface HomeRecent { name: string; condition: string; date: string }
export interface HomeData {
  kpis: KpiCard[];
  revenue: { label: string; value: number }[]; // R$ por mês
  donut: { total: number; segments: { label: string; value: number; color: string }[] };
  today: HomeToday[];
  recent: HomeRecent[];
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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
    revenue: [],
    donut: { total: 0, segments: [
      { label: "Concluídos", value: 0, color: SEGMENT_COLORS.done },
      { label: "Próximos", value: 0, color: SEGMENT_COLORS.upcoming },
      { label: "Cancelados", value: 0, color: SEGMENT_COLORS.cancelled },
    ] },
    today: [],
    recent: [],
  };
}

function demoHome(): HomeData {
  return {
    kpis: demoKpis,
    revenue: revenueLabels.map((label, i) => ({ label, value: revenueRanges.monthly[i] * 1000 })),
    donut: appointmentStats,
    today: demoToday.map((t, i) => ({ id: String(i), doctor: t.doctor, specialty: t.specialty, patient: t.patient, tag: t.patientId, time: t.time, status: t.status })),
    recent: demoRecent.map((p) => ({ name: p.name, condition: p.condition, date: p.date })),
  };
}

interface Raw {
  kpis: { patients: number; patients_prev: number; appointments: number; appointments_prev: number; revenue_cents: number; revenue_prev_cents: number; professionals: number };
  months: { month: string; revenue_cents: number }[];
  donut: { done: number; upcoming: number; cancelled: number };
  today: { id: string; professional: string; patient: string; procedure: string; time: string; status: string; is_return: boolean }[];
  recent: { name: string; procedure: string; date: string }[];
}

export async function getHomeData(orgId: string): Promise<HomeData> {
  if (!isSupabaseConfigured) return demoHome();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_home", { p_org: orgId });
  if (error || !data) return emptyHome(); // banco sem a 0016: mantém os zeros
  const r = data as Raw;
  const k = r.kpis;
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return {
    kpis: [
      { key: "patients", title: "Pacientes atendidos", value: k.patients.toLocaleString("pt-BR"), subtitle: "Este mês", ...trend(k.patients, k.patients_prev) },
      { key: "appointments", title: "Agendamentos", value: k.appointments.toLocaleString("pt-BR"), subtitle: "Este mês", ...trend(k.appointments, k.appointments_prev) },
      { key: "revenue", title: "Receita Mensal", value: brl(k.revenue_cents), subtitle: "Concluídos no mês", ...trend(k.revenue_cents, k.revenue_prev_cents) },
      { key: "doctors", title: "Profissionais Ativos", value: String(k.professionals), subtitle: k.professionals ? "Na agenda" : "Cadastre na Agenda", trend: "", trendUp: false },
    ],
    revenue: r.months.map((m) => ({ label: MONTHS[Number(m.month.slice(5, 7)) - 1], value: m.revenue_cents / 100 })),
    donut: {
      total: r.donut.done + r.donut.upcoming + r.donut.cancelled,
      segments: [
        { label: "Concluídos", value: r.donut.done, color: SEGMENT_COLORS.done },
        { label: "Próximos", value: r.donut.upcoming, color: SEGMENT_COLORS.upcoming },
        { label: "Cancelados", value: r.donut.cancelled, color: SEGMENT_COLORS.cancelled },
      ],
    },
    today: r.today.map((t) => ({
      id: t.id, doctor: t.professional, specialty: t.procedure, patient: t.patient, tag: t.is_return ? "Retorno" : "Primeira vez", time: t.time,
      status: t.status === "done" ? "done" : t.status === "in_progress" ? "in_progress" : t.status === "cancelled" ? "cancelled" : t.status === "confirmed" ? "confirmed" : "waiting",
    })),
    recent: r.recent.map((p) => ({ name: p.name, condition: p.procedure, date: fmtDay(p.date) })),
  };
}

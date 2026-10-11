import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { listFlows } from "./flows";
import { demoFlows } from "@/lib/demo-data";
import { resolvePeriod, type Period } from "@/lib/analytics/period";
import { EMPTY_TOTALS, type Totals } from "@/lib/analytics/metrics";
import { summarizeAnswers, type AnswerProfile, type AnswerRow } from "@/lib/analytics/answers";
import { estimatePotential } from "@/lib/analytics/potential";
import type { AnalyticsFilters } from "@/lib/analytics/filters";
import type { LeadStatus } from "@/lib/types";

// Métricas dos funis calculadas no banco (analytics_overview / analytics_answers,
// migration 0013). Nada aqui carrega eventos ou leads linha a linha: os números
// são exatos com qualquer volume, sem o limite de 1.000 linhas da API.

export interface SeriesPoint { bucket: string; visits: number; starts: number; completions: number; whatsapp: number; leads: number }
export interface StepPoint { step_index: number; step_id: string | null; label: string; views: number; completions: number }
export interface SourceRow { source: string; campaign: string; visits: number; leads: number; whatsapp: number; qualified: number }
export interface ProcedureRow { procedure: string; leads: number; whatsapp: number; qualified: number; advanced: number }
export interface FlowRow { flow_id: string; name: string; procedure: string | null; visits: number; starts: number; completions: number; whatsapp: number; leads: number }
export interface RecentLead { id: string; name: string; procedure: string; score: number; status: LeadStatus; whatsapp: boolean; created_at: string }

export interface FunnelAnalytics {
  available: boolean; // false = banco sem a 0013 (métricas indisponíveis, sem números falsos)
  demo: boolean;
  filters: AnalyticsFilters;
  period: Period;
  totals: Totals;
  previous: Totals;
  series: SeriesPoint[];
  steps: StepPoint[];
  sources: SourceRow[];
  procedures: ProcedureRow[];
  byFlow: FlowRow[];
  options: { flows: { id: string; name: string }[]; procedures: string[]; sources: string[]; campaigns: string[] };
  profile: AnswerProfile;
  potential: number;
  recent: RecentLead[];
}

interface OverviewJson {
  totals: Totals;
  series: SeriesPoint[];
  steps: Omit<StepPoint, "label">[];
  sources: SourceRow[];
  procedures: ProcedureRow[];
  by_flow: FlowRow[];
  filters: { procedures: string[]; sources: string[]; campaigns: string[] };
}

const num = (t: Partial<Totals> | undefined): Totals => {
  const out = { ...EMPTY_TOTALS };
  for (const k of Object.keys(out) as (keyof Totals)[]) out[k] = Number(t?.[k] ?? 0);
  return out;
};

function rpcArgs(orgId: string, f: AnalyticsFilters, from: string, to: string, bucket: string) {
  return {
    p_org: orgId, p_from: from, p_to: to, p_flow: f.flow, p_bucket: bucket,
    p_procedure: f.procedure, p_source: f.source, p_campaign: f.campaign,
  };
}

const MISSING_FN = new Set(["PGRST202", "42883"]);

export async function getFunnelAnalytics(orgId: string, filters: AnalyticsFilters): Promise<FunnelAnalytics> {
  const period = resolvePeriod(filters.range);
  if (!isSupabaseConfigured) return demoAnalytics(filters, period);

  const supabase = await createClient();
  const [cur, prev, answers, flows] = await Promise.all([
    supabase.rpc("analytics_overview", rpcArgs(orgId, filters, period.from, period.to, period.bucket)),
    supabase.rpc("analytics_overview", rpcArgs(orgId, filters, period.prevFrom, period.prevTo, period.bucket)),
    supabase.rpc("analytics_answers", {
      p_org: orgId, p_from: period.from, p_to: period.to, p_flow: filters.flow,
      p_procedure: filters.procedure, p_source: filters.source, p_campaign: filters.campaign,
    }),
    listFlows(orgId),
  ]);

  const flowOptions = flows.map((f) => ({ id: f.id, name: f.name }));
  if (cur.error) {
    if (!MISSING_FN.has(cur.error.code ?? "")) console.error("[analytics] falha ao calcular métricas", cur.error.code);
    return { ...emptyAnalytics(filters, period), available: false, options: { ...emptyAnalytics(filters, period).options, flows: flowOptions } };
  }

  const o = cur.data as OverviewJson;
  const totals = num(o.totals);
  const procedures = (o.procedures ?? []).map((p) => ({ ...p, leads: +p.leads, whatsapp: +p.whatsapp, qualified: +p.qualified, advanced: +p.advanced }));

  // Rótulo das etapas pelo id estável (Entrega B); posição como reserva.
  let steps: StepPoint[] = [];
  if (filters.flow && (o.steps ?? []).length > 0) {
    const { data: rows } = await supabase.from("flow_steps").select("id, position, type, config").eq("flow_id", filters.flow).order("position");
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
    steps = o.steps.map((s) => {
      const r = (s.step_id && byId.get(s.step_id)) || rows?.[s.step_index];
      const cfg = (r?.config ?? {}) as { title?: string };
      const title = (cfg.title ?? "").replace(/<[^>]+>/g, "").trim();
      return { ...s, views: +s.views, completions: +s.completions, label: title || `Etapa ${s.step_index + 1}` };
    });
  }

  return {
    available: true,
    demo: false,
    filters,
    period,
    totals,
    previous: prev.error ? { ...EMPTY_TOTALS } : num((prev.data as OverviewJson).totals),
    series: (o.series ?? []).map((p) => ({ bucket: p.bucket, visits: +p.visits, starts: +p.starts, completions: +p.completions, whatsapp: +p.whatsapp, leads: +p.leads })),
    steps,
    sources: (o.sources ?? []).map((s) => ({ ...s, visits: +s.visits, leads: +s.leads, whatsapp: +s.whatsapp, qualified: +s.qualified })),
    procedures,
    byFlow: o.by_flow ?? [],
    options: {
      flows: flowOptions,
      procedures: o.filters?.procedures ?? [],
      sources: o.filters?.sources ?? [],
      campaigns: o.filters?.campaigns ?? [],
    },
    profile: summarizeAnswers((answers.data ?? []) as AnswerRow[]),
    potential: estimatePotential(procedures),
    recent: await recentLeads(orgId, filters, period, flows),
  };
}

// Últimos leads dentro dos mesmos filtros (só as colunas da tabela).
async function recentLeads(orgId: string, f: AnalyticsFilters, period: Period, flows: { id: string; procedure: string | null }[]): Promise<RecentLead[]> {
  const supabase = await createClient();
  let q = supabase
    .from("lead_sessions")
    .select("id, name, procedure, score, status, whatsapp_clicked, created_at")
    .eq("organization_id", orgId)
    .gte("created_at", period.from)
    .lt("created_at", period.to)
    .order("created_at", { ascending: false })
    .limit(8);
  if (f.flow) q = q.eq("flow_id", f.flow);
  if (f.procedure) {
    const ids = flows.filter((x) => x.procedure === f.procedure).map((x) => x.id);
    if (ids.length === 0) return [];
    q = q.in("flow_id", ids);
  }
  if (f.source) q = f.source === "(direto)" ? q.or("utm_source.is.null,utm_source.eq.") : q.eq("utm_source", f.source);
  if (f.campaign) q = q.eq("utm_campaign", f.campaign);
  const { data } = await q;
  return (data ?? []).map((l) => ({
    id: l.id, name: l.name ?? "Anônimo", procedure: l.procedure ?? "—", score: l.score,
    status: l.status as LeadStatus, whatsapp: Boolean(l.whatsapp_clicked), created_at: l.created_at,
  }));
}

function emptyAnalytics(filters: AnalyticsFilters, period: Period): FunnelAnalytics {
  return {
    available: true, demo: false, filters, period,
    totals: { ...EMPTY_TOTALS }, previous: { ...EMPTY_TOTALS },
    series: [], steps: [], sources: [], procedures: [], byFlow: [],
    options: { flows: [], procedures: [], sources: [], campaigns: [] },
    profile: { gender: null, ages: null, pains: [] },
    potential: 0, recent: [],
  };
}

// Vitrine sem banco conectado (modo demo). Com banco real, nunca aparece.
function demoAnalytics(filters: AnalyticsFilters, period: Period): FunnelAnalytics {
  const totals: Totals = {
    visits: 1250, unique_visitors: 1010, starts: 870, completions: 620, exits: 64, whatsapp_clicks: 487,
    appointments: 96, leads: 640, leads_with_contact: 512, qualified: 210, warm: 260, cold: 170,
    final_cta: 120, leads_whatsapp: 470, devices_mobile: 560, devices_desktop: 80,
  };
  const previous: Totals = { ...totals, visits: 1100, starts: 760, completions: 540, whatsapp_clicks: 410, appointments: 80, leads: 560, qualified: 180 };
  const days = Math.min(30, Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000));
  const series: SeriesPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.parse(period.to) - (days - i) * 86400000 + 4 * 3600000).toISOString().slice(0, 10);
    const w = 0.7 + 0.3 * Math.sin(i / 3);
    return { bucket: d, visits: Math.round(42 * w), starts: Math.round(29 * w), completions: Math.round(21 * w), whatsapp: Math.round(16 * w), leads: Math.round(21 * w) };
  });
  const procedures: ProcedureRow[] = [
    { procedure: "Rinomodelação", leads: 320, whatsapp: 250, qualified: 120, advanced: 262 },
    { procedure: "Botox Full Face", leads: 210, whatsapp: 150, qualified: 60, advanced: 158 },
    { procedure: "Preenchimento Labial", leads: 110, whatsapp: 70, qualified: 30, advanced: 74 },
  ];
  return {
    available: true, demo: true, filters, period, totals, previous, series,
    steps: filters.flow ? [
      { step_index: 0, step_id: null, label: "Qual região mais te incomoda?", views: 860, completions: 790 },
      { step_index: 1, step_id: null, label: "Quando pretende realizar?", views: 780, completions: 700 },
      { step_index: 2, step_id: null, label: "Seus dados", views: 690, completions: 620 },
    ] : [],
    sources: [
      { source: "instagram", campaign: "Rino Setembro", visits: 640, leads: 330, whatsapp: 260, qualified: 120 },
      { source: "facebook", campaign: "Botox Setembro", visits: 380, leads: 190, whatsapp: 140, qualified: 55 },
      { source: "(direto)", campaign: "", visits: 230, leads: 120, whatsapp: 87, qualified: 35 },
    ],
    procedures,
    byFlow: [],
    options: { flows: demoFlows.map((f) => ({ id: f.id, name: f.name })), procedures: procedures.map((p) => p.procedure), sources: ["(direto)", "facebook", "instagram"], campaigns: ["Botox Setembro", "Rino Setembro"] },
    profile: {
      gender: { female: 480, male: 160 },
      ages: [{ label: "25-34 anos", count: 260 }, { label: "35-44 anos", count: 210 }, { label: "45+ anos", count: 120 }],
      pains: [{ label: "Ponta caída", count: 180 }, { label: "Rugas na testa", count: 140 }, { label: "Pés de galinha", count: 110 }],
    },
    potential: estimatePotential(procedures),
    recent: [
      { id: "lead-1", name: "Marina Souza", procedure: "Rinomodelação", score: 85, status: "whatsapp", whatsapp: true, created_at: "2026-09-17T14:22:00Z" },
      { id: "lead-2", name: "Carla Mendes", procedure: "Botox Full Face", score: 45, status: "new", whatsapp: false, created_at: "2026-09-16T09:10:00Z" },
    ],
  };
}

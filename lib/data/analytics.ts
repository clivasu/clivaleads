import "server-only";
import { listLeads } from "./leads";
import { tierFromScore } from "@/lib/scoring";

export interface ProcedureStat { name: string; color: string; leads: number; conv: number; active: boolean }
export interface FlowPoint { m: string; leads: number; wa: number }
export interface RecentLead { name: string; who: string; id: string; date: string; time: string; score: number; status: string }

export interface AnalyticsData {
  totalLeads: number;
  whatsappRate: number; // 0..1
  whatsappTrend: number; // pontos percentuais vs período anterior (aproximado)
  revenueEstimate: number;
  leadsTrend: number; // % de crescimento no mês vs anterior
  byProcedure: ProcedureStat[];
  monthly: FlowPoint[];
  yearly: FlowPoint[];
  recent: RecentLead[];
}

// Ticket médio estimado por procedimento (R$) para a receita estimada.
const TICKET: Record<string, number> = {
  "Rinomodelação": 1200,
  "Botox Full Face": 900,
  "Preenchimento Labial": 800,
  "Harmonização Facial": 1500,
};
const DEFAULT_TICKET = 800;

const PROC_PALETTE = ["#10b981", "#0ea5e9", "#ec4899", "#a855f7", "#f59e0b", "#14b8a6"];
const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  qualified: "Qualificado",
  whatsapp: "WhatsApp",
  scheduled: "Agendado",
  converted: "Convertido",
  lost: "Perdido",
};

function ticketFor(procedure: string | null): number {
  if (!procedure) return DEFAULT_TICKET;
  return TICKET[procedure] ?? DEFAULT_TICKET;
}

// Agrega os leads reais da organização em métricas para a tela de Analytics.
export async function getAnalytics(orgId: string): Promise<AnalyticsData> {
  const leads = await listLeads(orgId);
  const now = new Date();

  const totalLeads = leads.length;
  const waLeads = leads.filter((l) => l.whatsapp_clicked);
  const whatsappRate = totalLeads > 0 ? waLeads.length / totalLeads : 0;

  // Receita estimada: soma do ticket dos leads que avançaram para o WhatsApp/agenda.
  const revenueEstimate = leads
    .filter((l) => l.whatsapp_clicked || ["whatsapp", "scheduled", "converted"].includes(l.status))
    .reduce((sum, l) => sum + ticketFor(l.procedure), 0);

  // Por procedimento (top 6 por volume).
  const procMap = new Map<string, { leads: number; wa: number }>();
  for (const l of leads) {
    const key = l.procedure ?? "Outros";
    const cur = procMap.get(key) ?? { leads: 0, wa: 0 };
    cur.leads += 1;
    if (l.whatsapp_clicked) cur.wa += 1;
    procMap.set(key, cur);
  }
  const byProcedure: ProcedureStat[] = [...procMap.entries()]
    .sort((a, b) => b[1].leads - a[1].leads)
    .slice(0, 6)
    .map(([name, v], i) => ({
      name,
      color: PROC_PALETTE[i % PROC_PALETTE.length],
      leads: v.leads,
      conv: v.leads > 0 ? Math.round((v.wa / v.leads) * 100) : 0,
      active: v.leads > 0,
    }));

  // Fluxo mensal: últimos 7 meses.
  const monthly: FlowPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const inMonth = leads.filter((l) => { const c = new Date(l.created_at); return c.getFullYear() === y && c.getMonth() === m; });
    monthly.push({ m: MONTH_ABBR[m], leads: inMonth.length, wa: inMonth.filter((l) => l.whatsapp_clicked).length });
  }

  // Fluxo anual: últimos 6 anos.
  const yearly: FlowPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const y = now.getFullYear() - i;
    const inYear = leads.filter((l) => new Date(l.created_at).getFullYear() === y);
    yearly.push({ m: String(y), leads: inYear.length, wa: inYear.filter((l) => l.whatsapp_clicked).length });
  }

  // Tendência mês atual vs mês anterior.
  const thisMonth = monthly[monthly.length - 1]?.leads ?? 0;
  const prevMonth = monthly[monthly.length - 2]?.leads ?? 0;
  const leadsTrend = prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : (thisMonth > 0 ? 100 : 0);

  const waThis = monthly[monthly.length - 1]?.wa ?? 0;
  const waRateThis = thisMonth > 0 ? waThis / thisMonth : 0;
  const waRatePrev = prevMonth > 0 ? (monthly[monthly.length - 2]?.wa ?? 0) / prevMonth : 0;
  const whatsappTrend = Math.round((waRateThis - waRatePrev) * 100);

  // Atividades recentes (5 leads mais recentes com contato).
  const recent: RecentLead[] = [...leads]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 6)
    .map((l) => {
      const d = new Date(l.created_at);
      const tier = tierFromScore(l.score);
      const status = l.status === "converted" ? "Convertido"
        : l.whatsapp_clicked || l.status === "whatsapp" ? "WhatsApp"
        : l.status === "lost" ? "Perdido"
        : tier === "hot" ? "Qualificado"
        : STATUS_LABEL[l.status] ?? "Novo";
      return {
        name: l.procedure ?? "—",
        who: l.name ?? "Anônimo",
        id: l.id.slice(0, 8).toUpperCase(),
        date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        score: l.score,
        status,
      };
    });

  return { totalLeads, whatsappRate, whatsappTrend, revenueEstimate, leadsTrend, byProcedure, monthly, yearly, recent };
}

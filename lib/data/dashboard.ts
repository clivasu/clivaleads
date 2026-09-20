import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { demoFlows } from "@/lib/demo-data";

export interface Metrics {
  visitors: number;
  started: number;
  completed: number;
  whatsapp: number;
}

export interface ProcedureRow {
  procedure: string;
  visitors: number;
  completed: number;
  whatsapp: number;
}

export interface DashboardData {
  metrics: Metrics;
  byProcedure: ProcedureRow[];
}

function rate(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

export { rate };

// Dados de demonstração (números da especificação).
const DEMO: DashboardData = {
  metrics: { visitors: 1250, started: 870, completed: 620, whatsapp: 487 },
  byProcedure: [
    { procedure: "Rinomodelação", visitors: 620, completed: 340, whatsapp: 268 },
    { procedure: "Botox Full Face", visitors: 410, completed: 190, whatsapp: 140 },
    { procedure: "Preenchimento Labial", visitors: 220, completed: 90, whatsapp: 79 },
  ],
};

export async function getDashboardData(orgId: string): Promise<DashboardData> {
  if (!isSupabaseConfigured) return DEMO;

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("type, flow_id")
    .eq("organization_id", orgId);

  const counts = { visitors: 0, started: 0, completed: 0, whatsapp: 0 };
  const perFlow = new Map<string, { visitors: number; completed: number; whatsapp: number }>();

  for (const e of events ?? []) {
    const bucket =
      perFlow.get(e.flow_id) ?? { visitors: 0, completed: 0, whatsapp: 0 };
    if (e.type === "page_view") { counts.visitors++; bucket.visitors++; }
    if (e.type === "flow_started") counts.started++;
    if (e.type === "flow_completed") { counts.completed++; bucket.completed++; }
    if (e.type === "whatsapp_clicked") { counts.whatsapp++; bucket.whatsapp++; }
    perFlow.set(e.flow_id, bucket);
  }

  const { data: flows } = await supabase
    .from("flows")
    .select("id, procedure")
    .eq("organization_id", orgId);

  const byProcedure: ProcedureRow[] = (flows ?? []).map((f) => {
    const b = perFlow.get(f.id) ?? { visitors: 0, completed: 0, whatsapp: 0 };
    return { procedure: f.procedure ?? "—", ...b };
  });

  return { metrics: counts, byProcedure };
}

// Usado no fallback demo para listar funis também no painel.
export function demoFlowList() {
  return demoFlows;
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { demoFlows, getDemoFlowBySlug } from "@/lib/demo-data";
import type { Flow, FlowStep, PublicFlow } from "@/lib/types";

// Reidrata a árvore: extrai os blocos aninhados guardados em config.__children
// e ordena por position.
function hydrateSteps(raw: unknown[]): FlowStep[] {
  return (raw as FlowStep[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const cfg = (s.config ?? {}) as Record<string, unknown>;
      const { __children, ...config } = cfg;
      const children = Array.isArray(__children)
        ? (__children as FlowStep[])
        : undefined;
      return { ...s, config: config as FlowStep["config"], children };
    });
}

// Lista os funis de uma org (para o painel). Demo fallback.
export async function listFlows(orgId: string): Promise<Flow[]> {
  if (!isSupabaseConfigured) return demoFlows;
  const supabase = await createClient();
  const { data } = await supabase
    .from("flows")
    .select("*")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });
  return (data as Flow[]) ?? [];
}

// Busca um funil por id, com steps (para o builder). Demo fallback.
export async function getFlowById(id: string): Promise<PublicFlow | null> {
  if (!isSupabaseConfigured) {
    return demoFlows.find((f) => f.id === id) ?? null;
  }
  const supabase = await createClient();
  const { data: flow } = await supabase
    .from("flows")
    .select(
      "*, organization:organizations(*), steps:flow_steps(id, flow_id, position, type, config)",
    )
    .eq("id", id)
    .single();
  if (!flow) return null;
  return { ...(flow as PublicFlow), steps: hydrateSteps(flow.steps as unknown[]) };
}

// Busca um funil PUBLICADO por slug, com org e steps ordenados.
// Sem Supabase conectado, cai para os dados de demonstração (seed em memória).
export async function getPublicFlow(slug: string): Promise<PublicFlow | null> {
  if (!isSupabaseConfigured) {
    return getDemoFlowBySlug(slug);
  }

  const supabase = await createClient();

  const { data: flow, error } = await supabase
    .from("flows")
    .select(
      "*, organization:organizations(*), steps:flow_steps(id, flow_id, position, type, config)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !flow) return null;

  return { ...(flow as PublicFlow), steps: hydrateSteps(flow.steps as unknown[]) };
}

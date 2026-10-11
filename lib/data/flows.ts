import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { demoFlows, getDemoFlowBySlug as demoBySlug } from "@/lib/demo-data";
import { specialtyFlows } from "@/lib/specialty-templates";

// Demo: modelos por especialidade também abrem no builder e no link público.
const getDemoFlowBySlug = (slug: string) => demoBySlug(slug) ?? specialtyFlows.find((f) => f.slug === slug) ?? null;
import type { Flow, FlowStep, PublicFlow } from "@/lib/types";

// Colunas que podem ir para a página pública do funil (sem settings: as
// configurações não são usadas pelo funil e não devem ir para o navegador).
const PUBLIC_FLOW_COLS =
  "id, organization_id, name, slug, procedure, description, cover_image_url, status, whatsapp_number, final_message, created_at, updated_at";
const PUBLIC_ORG_COLS = "id, name, slug, logo_url, primary_color, whatsapp_number, default_message, instagram";

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
    return [...demoFlows, ...specialtyFlows].find((f) => f.id === id) ?? null;
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

// Busca um funil PUBLICADO por identificador da conta + slug do funil.
// URL nova: /<handle>/<slug>  (ex.: /marco/estetica)
export async function getPublicFlowByHandle(
  handle: string,
  slug: string,
): Promise<PublicFlow | null> {
  if (!isSupabaseConfigured) {
    return getDemoFlowBySlug(slug);
  }
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", handle)
    .single();
  if (!org) return null;

  const { data: flow, error } = await supabase
    .from("flows")
    .select(
      `${PUBLIC_FLOW_COLS}, organization:organizations(${PUBLIC_ORG_COLS}), steps:flow_steps(id, flow_id, position, type, config)`,
    )
    .eq("organization_id", org.id)
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (error || !flow) return null;
  return { ...(flow as unknown as PublicFlow), steps: hydrateSteps(flow.steps as unknown[]) };
}

// Lista os funis publicados de uma conta (para a página /<handle>).
export async function getPublicOrgFunnels(
  handle: string,
): Promise<{ org: PublicFlow["organization"]; flows: Flow[] } | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select(PUBLIC_ORG_COLS)
    .eq("slug", handle)
    .single();
  if (!org) return null;
  const { data: flows } = await supabase
    .from("flows")
    .select(PUBLIC_FLOW_COLS)
    .eq("organization_id", org.id)
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  return { org: org as PublicFlow["organization"], flows: (flows as Flow[]) ?? [] };
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
      `${PUBLIC_FLOW_COLS}, organization:organizations(${PUBLIC_ORG_COLS}), steps:flow_steps(id, flow_id, position, type, config)`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !flow) return null;

  return { ...(flow as unknown as PublicFlow), steps: hydrateSteps(flow.steps as unknown[]) };
}

// Configurações privadas do funil (integrações e contatos internos), para o
// editor. O segredo do webhook nunca sai do servidor: só "está configurado".
export interface FlowPrivateSettingsView {
  webhookUrl: string;
  autoSendLead: boolean;
  notifyEmail: string;
  notifyWhatsapp: string;
  notifyOnLead: boolean;
  hasWebhookSecret: boolean;
  hasHeadScripts: boolean;
}

export const EMPTY_PRIVATE_SETTINGS: FlowPrivateSettingsView = {
  webhookUrl: "", autoSendLead: false, notifyEmail: "", notifyWhatsapp: "", notifyOnLead: true,
  hasWebhookSecret: false, hasHeadScripts: false,
};

export async function getFlowPrivateSettings(flowId: string): Promise<FlowPrivateSettingsView> {
  if (!isSupabaseConfigured) return EMPTY_PRIVATE_SETTINGS;
  // Só owner/admin da clínica do funil enxergam (RLS da própria tabela).
  const supabase = await createClient();
  const { data: visible } = await supabase
    .from("flow_private_settings")
    .select("flow_id")
    .eq("flow_id", flowId)
    .maybeSingle();
  if (!visible) return EMPTY_PRIVATE_SETTINGS;

  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient()
    .from("flow_private_settings")
    .select("webhook_url, webhook_secret, auto_send_lead, head_scripts, notify_email, notify_whatsapp, notify_on_lead")
    .eq("flow_id", flowId)
    .maybeSingle();
  if (!data) return EMPTY_PRIVATE_SETTINGS;
  return {
    webhookUrl: data.webhook_url ?? "",
    autoSendLead: Boolean(data.auto_send_lead),
    notifyEmail: data.notify_email ?? "",
    notifyWhatsapp: data.notify_whatsapp ?? "",
    notifyOnLead: data.notify_on_lead ?? true,
    hasWebhookSecret: Boolean(data.webhook_secret),
    hasHeadScripts: Boolean(data.head_scripts),
  };
}

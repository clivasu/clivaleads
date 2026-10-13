"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { siteUrl } from "@/lib/site-url";
import { rateLimit } from "@/lib/security/rate-limit";
import { buildTestPayload, shortError, signPayload, validateWebhookUrl } from "@/lib/integrations/webhook-core";
import { postJson } from "@/lib/integrations/webhook-http";
import { newWebhookSecret, processDelivery, requeueDelivery } from "@/lib/integrations/webhook-outbox";

// Ações do editor para o webhook. Todas exigem owner/admin da clínica do funil.

async function requireFlowAdmin(flowId: string): Promise<{ userId: string; orgId: string; flowName: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: flow } = await supabase.from("flows").select("organization_id, name").eq("id", flowId).maybeSingle();
  if (!flow) return null;
  const { data: m } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", flow.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!m || !["owner", "admin"].includes(m.role as string)) return null;
  return { userId: user.id, orgId: flow.organization_id as string, flowName: flow.name as string };
}

export interface WebhookTestResult { ok: boolean; status?: number; ms?: number; message: string }

// Envia um evento de teste para a URL digitada (mesmo antes de salvar), com o
// segredo salvo. Nada é gravado: nenhum lead fictício é criado.
export async function testWebhook(flowId: string, url: string): Promise<WebhookTestResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Disponível com o banco conectado." };
  const who = await requireFlowAdmin(flowId);
  if (!who) return { ok: false, message: "Sem permissão para este funil." };
  if (!rateLimit(`webhook-test:${who.userId}`, 5)) return { ok: false, message: "Muitos testes seguidos. Aguarde um minuto." };
  const check = validateWebhookUrl(url);
  if (!check.ok) return { ok: false, message: check.error };

  const { data: cfg } = await createAdminClient().from("flow_private_settings").select("webhook_secret").eq("flow_id", flowId).maybeSingle();
  const body = JSON.stringify(buildTestPayload({ id: flowId, name: who.flowName }, siteUrl()));
  const headers: Record<string, string> = { "X-Cliva-Event": "webhook.test", "X-Cliva-Delivery": "test" };
  if (cfg?.webhook_secret) headers["X-Cliva-Signature"] = signPayload(cfg.webhook_secret, Math.floor(Date.now() / 1000), body);

  const r = await postJson(check.url.toString(), body, headers);
  if (r.ok) return { ok: true, status: r.status, ms: r.ms, message: `Recebido pelo destino (HTTP ${r.status}) em ${r.ms} ms.${cfg?.webhook_secret ? "" : " Dica: gere um segredo para o CRM conferir a assinatura."}` };
  return { ok: false, status: r.status, ms: r.ms, message: r.status ? `O destino respondeu HTTP ${r.status}.` : `Não foi possível entregar: ${shortError(r.error)}.` };
}

// Gera e grava um segredo novo. É mostrado uma única vez ao usuário.
export async function generateWebhookSecret(flowId: string): Promise<{ ok: boolean; secret?: string; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Disponível com o banco conectado." };
  const who = await requireFlowAdmin(flowId);
  if (!who) return { ok: false, message: "Sem permissão para este funil." };
  const secret = newWebhookSecret();
  const { error } = await createAdminClient()
    .from("flow_private_settings")
    .upsert({ flow_id: flowId, organization_id: who.orgId, webhook_secret: secret, updated_at: new Date().toISOString() }, { onConflict: "flow_id" });
  if (error) return { ok: false, message: "Não foi possível gerar o segredo." };
  return { ok: true, secret };
}

export interface DeliveryRow {
  id: string; status: "pending" | "delivered" | "failed"; attempts: number;
  last_status: number | null; last_error: string | null; created_at: string; last_attempt_at: string | null; next_attempt_at: string;
}

// Últimas entregas do funil (RLS: owner/admin da clínica).
export async function listWebhookDeliveries(flowId: string): Promise<DeliveryRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("webhook_deliveries")
    .select("id, status, attempts, last_status, last_error, created_at, last_attempt_at, next_attempt_at")
    .eq("flow_id", flowId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as DeliveryRow[]) ?? [];
}

export async function resendWebhookDelivery(flowId: string, deliveryId: string): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Disponível com o banco conectado." };
  const who = await requireFlowAdmin(flowId);
  if (!who) return { ok: false, message: "Sem permissão para este funil." };
  if (!rateLimit(`webhook-resend:${who.userId}`, 10)) return { ok: false, message: "Aguarde um minuto." };
  const db = createAdminClient();
  if (!(await requeueDelivery(db, deliveryId, flowId))) return { ok: false, message: "Entrega não encontrada ou já entregue." };
  const r = await processDelivery(db, deliveryId);
  return r === "delivered" ? { ok: true, message: "Entregue." } : { ok: false, message: "Ainda falhou. Veja o motivo no histórico; uma nova tentativa fica agendada." };
}

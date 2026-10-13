import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { buildLeadPayload, MAX_ATTEMPTS, nextRetryDelaySec, shortError, signPayload } from "./webhook-core";
import { postJson, type SendResult } from "./webhook-http";

// Fila durável de webhooks (tabela webhook_deliveries, migration 0015).
// 1) a captura do lead enfileira (idempotente: um lead = uma entrega);
// 2) a entrega é tentada logo após a resposta ao paciente (after());
// 3) falhas voltam para a fila com espera crescente; o cron e novas
//    capturas processam o que estiver vencido.

type Admin = ReturnType<typeof createAdminClient>;
type Sender = (url: string, body: string, headers: Record<string, string>) => Promise<SendResult>;

// Cria a entrega se o funil tem envio automático configurado. Devolve o id.
export async function enqueueLeadWebhook(db: Admin, p: { organizationId: string; flowId: string; leadId: string }): Promise<string | null> {
  const { data: cfg, error: cfgErr } = await db
    .from("flow_private_settings")
    .select("webhook_url, auto_send_lead")
    .eq("flow_id", p.flowId)
    .maybeSingle();
  if (cfgErr || !cfg?.auto_send_lead || !cfg.webhook_url) return null;

  const { data, error } = await db
    .from("webhook_deliveries")
    .insert({ organization_id: p.organizationId, flow_id: p.flowId, lead_session_id: p.leadId, event: "lead.created" })
    .select("id")
    .single();
  if (error) {
    // 23505 = já enfileirado (reenvio do mesmo lead). 42P01 = banco sem a 0015.
    if (error.code !== "23505" && error.code !== "42P01" && error.code !== "PGRST205") console.error("[webhook] falha ao enfileirar", error.code);
    return null;
  }
  return data.id as string;
}

// Tenta uma entrega. Seguro contra execução dupla: só quem "pega" a linha
// (update condicional) envia; a linha fica reservada por 5 min durante o envio.
export async function processDelivery(db: Admin, id: string, send: Sender = postJson): Promise<"delivered" | "retry" | "failed" | "skipped"> {
  const now = new Date();
  const { data: due } = await db
    .from("webhook_deliveries")
    .select("id, attempts, organization_id, flow_id, lead_session_id")
    .eq("id", id)
    .eq("status", "pending")
    .lte("next_attempt_at", now.toISOString())
    .maybeSingle();
  if (!due) return "skipped";
  const attempts = (due.attempts as number) + 1;
  const { data: claimed } = await db
    .from("webhook_deliveries")
    .update({ attempts, last_attempt_at: now.toISOString(), next_attempt_at: new Date(now.getTime() + 300_000).toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .eq("attempts", due.attempts)
    .select("id")
    .maybeSingle();
  if (!claimed) return "skipped";

  const finish = async (r: { ok: boolean; status?: number; error?: string }) => {
    const retryIn = r.ok ? null : nextRetryDelaySec(attempts);
    const status = r.ok ? "delivered" : retryIn === null ? "failed" : "pending";
    await db.from("webhook_deliveries").update({
      status,
      last_status: r.status ?? null,
      last_error: r.ok ? null : (r.error ?? (r.status ? `HTTP ${r.status}` : "falha")).slice(0, 200),
      next_attempt_at: retryIn === null ? now.toISOString() : new Date(Date.now() + retryIn * 1000).toISOString(),
    }).eq("id", id);
    return r.ok ? "delivered" as const : status === "failed" ? "failed" as const : "retry" as const;
  };

  const [{ data: cfg }, { data: lead }, { data: flow }] = await Promise.all([
    db.from("flow_private_settings").select("webhook_url, webhook_secret, auto_send_lead, webhook_include_answers").eq("flow_id", due.flow_id).maybeSingle(),
    db.from("lead_sessions")
      .select("id, created_at, name, phone, email, score, procedure, status, whatsapp_clicked, utm_source, utm_medium, utm_campaign, utm_content, utm_term")
      .eq("id", due.lead_session_id).maybeSingle(),
    db.from("flows").select("id, name, slug, organization:organizations(slug)").eq("id", due.flow_id).maybeSingle(),
  ]);
  if (!cfg?.webhook_url || !cfg.auto_send_lead) return finish({ ok: false, error: "envio automático desligado" });
  if (!lead || !flow) return finish({ ok: false, error: "lead ou funil removido" });

  let answers: { question_title: string; answer_label: string }[] | undefined;
  if (cfg.webhook_include_answers) {
    const { data } = await db.from("lead_answers").select("question_title, answer_label").eq("lead_session_id", lead.id);
    answers = (data ?? []) as typeof answers;
  }
  const org = (Array.isArray(flow.organization) ? flow.organization[0] : flow.organization) as { slug: string } | null;
  const payload = buildLeadPayload({ deliveryId: id, lead: lead as never, flow: flow as never, organization: { slug: org?.slug ?? "" }, answers }, siteUrl());
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "X-Cliva-Event": "lead.created", "X-Cliva-Delivery": id, "Idempotency-Key": id };
  if (cfg.webhook_secret) headers["X-Cliva-Signature"] = signPayload(cfg.webhook_secret, Math.floor(Date.now() / 1000), body);

  const res = await send(cfg.webhook_url, body, headers);
  return finish({ ok: res.ok, status: res.status, error: res.ok ? undefined : res.status ? `HTTP ${res.status}` : shortError(res.error) });
}

// Processa entregas vencidas (cron, novas capturas e "Reenviar").
export async function processDueDeliveries(db: Admin, limit = 10, send: Sender = postJson): Promise<number> {
  const { data, error } = await db
    .from("webhook_deliveries")
    .select("id")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(limit);
  if (error || !data) return 0;
  let n = 0;
  for (const d of data) { await processDelivery(db, d.id as string, send); n++; }
  return n;
}

// Reabre uma entrega que falhou (botão "Reenviar"); zera a contagem.
export async function requeueDelivery(db: Admin, id: string, flowId: string): Promise<boolean> {
  const { data } = await db
    .from("webhook_deliveries")
    .update({ status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
    .eq("id", id)
    .eq("flow_id", flowId)
    .neq("status", "delivered")
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export function newWebhookSecret(): string {
  return `whsec_${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
}

export { MAX_ATTEMPTS };

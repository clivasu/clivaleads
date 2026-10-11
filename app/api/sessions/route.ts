import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getBillingStateAdmin, monthStartISO } from "@/lib/data/billing";
import { readJsonLimited, sessionCreateSchema, sessionPatchSchema } from "@/lib/security/validation";
import { issueLeadToken, verifyLeadToken } from "@/lib/security/lead-token";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { scoreAnswers, totalFrom } from "@/lib/security/scoring";
import type { FlowStep } from "@/lib/types";

// Captura de leads dos funis públicos (sem login do paciente).
// - A clínica é derivada do funil (publicado), nunca do que o navegador envia.
// - O score é recalculado aqui a partir da definição do funil.
// - client_ref torna o envio idempotente (retry/refresh não duplica).
// - O PATCH do WhatsApp exige o token devolvido na criação.

const fail = (status: number, error = "invalid_request") => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const hdrs = await headers();
  if (!rateLimit(`sessions:${clientIp(hdrs)}`, 20)) return fail(429, "rate_limited");

  const parsed = await readJsonLimited(request);
  if (!parsed.ok) return fail(parsed.status);
  const v = sessionCreateSchema.safeParse(parsed.data);
  if (!v.success) return fail(400);
  const body = v.data;

  if (!isSupabaseConfigured) {
    // Modo demo: devolve id fake para o fluxo do lead continuar.
    return NextResponse.json({ ok: true, id: "demo-session", token: null, score: 0, skipped: true });
  }

  const supabase = createAdminClient();

  // Funil publicado + clínica dona dele.
  const { data: flow } = await supabase
    .from("flows")
    .select("id, organization_id, status, steps:flow_steps(id, flow_id, position, type, config)")
    .eq("id", body.flow_id)
    .eq("status", "published")
    .maybeSingle();
  if (!flow) return fail(404, "flow_not_found");
  const organization_id = flow.organization_id as string;

  // Reenvio do mesmo lead (retry, refresh, duplo clique): devolve o existente.
  if (body.client_ref) {
    const { data: existing } = await supabase
      .from("lead_sessions")
      .select("id, score, flow_id")
      .eq("client_ref", body.client_ref)
      .maybeSingle();
    if (existing && existing.flow_id === flow.id) {
      return NextResponse.json({ ok: true, id: existing.id, token: issueLeadToken(existing.id), score: existing.score, duplicate: true });
    }
    if (existing) return fail(409, "conflict");
  }

  // Limite do plano: sem assinatura ou com a cota de leads do mês esgotada,
  // o funil continua funcionando para o paciente, mas o lead não é gravado.
  const billing = await getBillingStateAdmin(organization_id);
  if (billing.enabled) {
    if (!billing.hasAccess) return fail(402, "subscription_inactive");
    if (billing.plan) {
      const { count } = await supabase
        .from("lead_sessions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization_id)
        .gte("created_at", monthStartISO());
      if ((count ?? 0) >= billing.plan.leadsPerMonth) return fail(402, "lead_limit");
    }
  }

  const answers = body.answers;
  const scores = scoreAnswers((flow.steps ?? []) as FlowStep[], answers);
  const score = totalFrom(scores);

  const cookieStore = await cookies();
  const session_id = cookieStore.get("pl_sid")?.value ?? crypto.randomUUID();

  const row = {
      session_id,
      client_ref: body.client_ref ?? null,
      flow_id: flow.id,
      organization_id,
      name: body.contact?.name || null,
      phone: body.contact?.phone || null,
      email: body.contact?.email || null,
      procedure: body.procedure ?? null,
      score,
      status: body.disqualified ? "lost" : body.whatsapp_clicked ? "whatsapp" : "new",
      whatsapp_clicked: body.whatsapp_clicked ?? false,
      device: body.device ?? null,
      browser: body.browser ?? null,
      entry_page: body.entry_page ?? null,
      referrer: hdrs.get("referer")?.slice(0, 500) ?? null,
      utm_source: cookieStore.get("utm_source")?.value?.slice(0, 200) ?? null,
      utm_medium: cookieStore.get("utm_medium")?.value?.slice(0, 200) ?? null,
      utm_campaign: cookieStore.get("utm_campaign")?.value?.slice(0, 200) ?? null,
      utm_content: cookieStore.get("utm_content")?.value?.slice(0, 200) ?? null,
      utm_term: cookieStore.get("utm_term")?.value?.slice(0, 200) ?? null,
  };
  let { data: session, error } = await supabase.from("lead_sessions").insert(row).select("id").single();
  // Banco ainda sem a coluna client_ref (migration 0010 não aplicada): grava sem ela.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    const { client_ref: _omit, ...legacy } = row;
    void _omit;
    ({ data: session, error } = await supabase.from("lead_sessions").insert(legacy).select("id").single());
  }

  if (error || !session) {
    // Corrida entre dois envios iguais: o outro já gravou.
    if (error?.code === "23505" && body.client_ref) {
      const { data: existing } = await supabase.from("lead_sessions").select("id, score").eq("client_ref", body.client_ref).maybeSingle();
      if (existing) return NextResponse.json({ ok: true, id: existing.id, token: issueLeadToken(existing.id), score: existing.score, duplicate: true });
    }
    console.error("[sessions] falha ao gravar lead", error?.code);
    return fail(500, "save_failed");
  }

  if (answers.length > 0) {
    const { error: answersError } = await supabase.from("lead_answers").insert(
      answers.map((a, i) => ({
        lead_session_id: session.id,
        organization_id,
        question_key: a.question_key ?? null,
        question_title: a.question_title,
        answer_value: a.answer_value,
        answer_label: a.answer_label,
        score: scores[i],
      })),
    );
    if (answersError) {
      // Sem respostas o lead fica incompleto: desfaz para não registrar meio lead.
      await supabase.from("lead_sessions").delete().eq("id", session.id);
      console.error("[sessions] falha ao gravar respostas", answersError.code);
      return fail(500, "save_failed");
    }
  }

  return NextResponse.json({ ok: true, id: session.id, token: issueLeadToken(session.id), score });
}

// Marca a conversão (clique no botão final) numa sessão já registrada.
export async function PATCH(request: NextRequest) {
  const hdrs = await headers();
  if (!rateLimit(`sessions-patch:${clientIp(hdrs)}`, 30)) return fail(429, "rate_limited");

  const parsed = await readJsonLimited(request);
  if (!parsed.ok) return fail(parsed.status);
  const v = sessionPatchSchema.safeParse(parsed.data);
  if (!v.success) return fail(400);
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, skipped: true });
  if (!verifyLeadToken(v.data.id, v.data.token)) return fail(403, "forbidden");

  const supabase = createAdminClient();
  // Não rebaixa um lead que a clínica já marcou como agendado/convertido.
  const { error } = await supabase
    .from("lead_sessions")
    .update({ whatsapp_clicked: true, status: "whatsapp" })
    .eq("id", v.data.id)
    .in("status", ["new", "whatsapp", "lost"]);
  if (error) {
    console.error("[sessions] falha ao marcar whatsapp", error.code);
    return fail(500, "save_failed");
  }
  // Mesmo que o status não mude (já agendado), registra o clique.
  await supabase.from("lead_sessions").update({ whatsapp_clicked: true }).eq("id", v.data.id);
  return NextResponse.json({ ok: true });
}

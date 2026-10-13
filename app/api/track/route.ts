import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { readJsonLimited, trackEventSchema, trackSchema } from "@/lib/security/validation";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

// Eventos dos funis públicos, em lote. Só tipos que os relatórios usam e que o
// check da tabela events aceita; a clínica é derivada do funil publicado.
// metadata não é aceita do navegador (evita gravar dado pessoal/sensível).
export async function POST(request: NextRequest) {
  const hdrs = await headers();
  if (!rateLimit(`track:${clientIp(hdrs)}`, 60)) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = await readJsonLimited(request);
  if (!parsed.ok) return NextResponse.json({ ok: false }, { status: parsed.status });
  const top = trackSchema.safeParse(parsed.data);
  if (!top.success) return NextResponse.json({ ok: false }, { status: 400 });

  const raw = "events" in top.data && Array.isArray(top.data.events) ? top.data.events : [top.data];
  const list = raw.map((e) => trackEventSchema.safeParse(e)).filter((r) => r.success).map((r) => r.data!);
  if (list.length === 0) return NextResponse.json({ ok: true, stored: 0 });

  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, skipped: true });

  const supabase = createAdminClient();
  const flowIds = [...new Set(list.map((e) => e.flow_id))];
  const { data: flows } = await supabase
    .from("flows")
    .select("id, organization_id")
    .in("id", flowIds)
    .eq("status", "published");
  const orgOf = new Map((flows ?? []).map((f) => [f.id as string, f.organization_id as string]));

  const jar = await cookies();
  const session_id = jar.get("pl_sid")?.value ?? null;
  const utm_source = jar.get("utm_source")?.value?.slice(0, 200) || null;
  const utm_campaign = jar.get("utm_campaign")?.value?.slice(0, 200) || null;
  const rows = list
    .filter((e) => orgOf.has(e.flow_id))
    .map((e) => ({
      flow_id: e.flow_id,
      organization_id: orgOf.get(e.flow_id)!,
      type: e.type,
      session_id,
      metadata: {},
      event_id: e.event_id ?? crypto.randomUUID(),
      step_index: e.step_index ?? null,
      step_id: e.step_id ?? null,
      utm_source,
      utm_campaign,
    }));
  if (rows.length === 0) return NextResponse.json({ ok: true, stored: 0 });

  // Reenvio do mesmo lote (rede instável, sendBeacon + fetch): o event_id
  // repetido é ignorado pelo índice único, sem contar duas vezes.
  let { error } = await supabase.from("events").upsert(rows, { onConflict: "event_id", ignoreDuplicates: true });

  // Banco ainda sem a 0013: grava só os tipos e colunas antigos.
  if (error && ["42703", "PGRST204", "42P10", "23514"].includes(error.code ?? "")) {
    const legacy = rows
      .filter((r) => LEGACY_TYPES.has(r.type))
      .map(({ flow_id, organization_id, type, session_id, metadata }) => ({ flow_id, organization_id, type, session_id, metadata }));
    error = legacy.length ? (await supabase.from("events").insert(legacy)).error : null;
  }
  if (error) {
    console.error("[track] falha ao gravar eventos", error.code);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: rows.length });
}

// Tipos aceitos pelo check da tabela antes da migration 0013.
const LEGACY_TYPES = new Set(["page_view", "flow_started", "flow_completed", "whatsapp_clicked"]);

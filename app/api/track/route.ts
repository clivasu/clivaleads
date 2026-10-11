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

  const rows = list
    .filter((e) => orgOf.has(e.flow_id))
    .map((e) => ({ flow_id: e.flow_id, organization_id: orgOf.get(e.flow_id)!, type: e.type }));
  if (rows.length === 0) return NextResponse.json({ ok: true, stored: 0 });

  const session_id = (await cookies()).get("pl_sid")?.value ?? null;
  const { error } = await supabase.from("events").insert(rows.map((r) => ({ ...r, session_id, metadata: {} })));
  if (error) {
    console.error("[track] falha ao gravar eventos", error.code);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: rows.length });
}

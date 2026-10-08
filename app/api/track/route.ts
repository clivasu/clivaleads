import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

// Tipos gravados no banco: os que os relatórios leem e que o check da
// tabela events aceita (um tipo inválido derrubaria o lote inteiro).
const ALLOWED = new Set([
  "page_view",
  "flow_started",
  "flow_completed",
  "whatsapp_clicked",
]);
const MAX_EVENTS = 50;

interface IncomingEvent {
  type?: string;
  flow_id?: string | null;
  organization_id?: string;
  metadata?: Record<string, unknown>;
}

// Aceita um lote { events: [...] } ou, de páginas antigas em cache, um evento solto.
export async function POST(request: NextRequest) {
  let payload: { events?: IncomingEvent[] } & IncomingEvent;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const list = (Array.isArray(payload?.events) ? payload.events : [payload])
    .slice(0, MAX_EVENTS)
    .filter((e) => e && typeof e.type === "string" && ALLOWED.has(e.type) && typeof e.organization_id === "string");

  if (list.length === 0) return NextResponse.json({ ok: true, stored: 0 });

  if (!isSupabaseConfigured) {
    // Sem banco conectado ainda: aceita silenciosamente (modo demo).
    return NextResponse.json({ ok: true, skipped: true });
  }

  const cookieStore = await cookies();
  const session_id = cookieStore.get("pl_sid")?.value ?? null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("events").insert(
    list.map((e) => ({
      organization_id: e.organization_id,
      flow_id: e.flow_id ?? null,
      session_id,
      type: e.type,
      metadata: e.metadata ?? {},
    })),
  );
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true, stored: list.length });
}

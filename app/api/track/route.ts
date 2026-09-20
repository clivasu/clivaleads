import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function POST(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { type, flow_id, organization_id, metadata } = payload ?? {};
  if (!type || !organization_id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    // Sem banco conectado ainda: aceita silenciosamente (modo demo).
    return NextResponse.json({ ok: true, skipped: true });
  }

  const cookieStore = await cookies();
  const session_id = cookieStore.get("pl_sid")?.value ?? null;

  const supabase = createAdminClient();
  await supabase.from("events").insert({
    organization_id,
    flow_id: flow_id ?? null,
    session_id,
    type,
    metadata: metadata ?? {},
  });

  return NextResponse.json({ ok: true });
}

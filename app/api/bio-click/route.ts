import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function POST(request: NextRequest) {
  let payload: { bio_page_id?: string; label?: string; url?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { bio_page_id, label, url } = payload;
  if (!bio_page_id) return NextResponse.json({ ok: false }, { status: 400 });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, skipped: true });

  const supabase = createAdminClient();
  // busca a org da bio para gravar o clique com o organization_id correto
  const { data: page } = await supabase
    .from("bio_pages")
    .select("organization_id")
    .eq("id", bio_page_id)
    .single();
  if (!page) return NextResponse.json({ ok: false }, { status: 404 });

  await supabase.from("bio_clicks").insert({
    bio_page_id,
    organization_id: page.organization_id,
    label: label ?? null,
    url: url ?? null,
  });

  return NextResponse.json({ ok: true });
}

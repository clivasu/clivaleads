import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { bioClickSchema, readJsonLimited } from "@/lib/security/validation";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

// Clique num link da bio pública. A clínica vem da própria bio (publicada).
export async function POST(request: NextRequest) {
  const hdrs = await headers();
  if (!rateLimit(`bio:${clientIp(hdrs)}`, 60)) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = await readJsonLimited(request);
  if (!parsed.ok) return NextResponse.json({ ok: false }, { status: parsed.status });
  const v = bioClickSchema.safeParse(parsed.data);
  if (!v.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, skipped: true });

  const supabase = createAdminClient();
  const { data: page } = await supabase
    .from("bio_pages")
    .select("organization_id")
    .eq("id", v.data.bio_page_id)
    .eq("status", "published")
    .maybeSingle();
  if (!page) return NextResponse.json({ ok: false }, { status: 404 });

  const { error } = await supabase.from("bio_clicks").insert({
    bio_page_id: v.data.bio_page_id,
    organization_id: page.organization_id,
    label: v.data.label ?? null,
    url: v.data.url ?? null,
  });
  if (error) {
    console.error("[bio-click] falha ao gravar clique", error.code);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { totalScore } from "@/lib/scoring";
import type { LeadAnswer } from "@/lib/types";

interface Body {
  flow_id: string;
  organization_id: string;
  procedure?: string | null;
  answers: LeadAnswer[];
  device?: string;
  browser?: string;
  entry_page?: string;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { flow_id, organization_id, procedure, answers = [] } = body;
  if (!flow_id || !organization_id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const score = totalScore(answers);

  if (!isSupabaseConfigured) {
    // Modo demo: devolve id fake para o fluxo do lead continuar.
    return NextResponse.json({ ok: true, id: "demo-session", score, skipped: true });
  }

  const cookieStore = await cookies();
  const hdrs = await headers();
  const session_id = cookieStore.get("pl_sid")?.value ?? crypto.randomUUID();

  const supabase = createAdminClient();

  const { data: session, error } = await supabase
    .from("lead_sessions")
    .insert({
      session_id,
      flow_id,
      organization_id,
      procedure: procedure ?? null,
      score,
      status: "new",
      device: body.device ?? null,
      browser: body.browser ?? null,
      entry_page: body.entry_page ?? null,
      referrer: hdrs.get("referer"),
      utm_source: cookieStore.get("utm_source")?.value ?? null,
      utm_medium: cookieStore.get("utm_medium")?.value ?? null,
      utm_campaign: cookieStore.get("utm_campaign")?.value ?? null,
      utm_content: cookieStore.get("utm_content")?.value ?? null,
      utm_term: cookieStore.get("utm_term")?.value ?? null,
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }

  if (answers.length > 0) {
    await supabase.from("lead_answers").insert(
      answers.map((a) => ({
        lead_session_id: session.id,
        organization_id,
        question_key: (a as any).question_key ?? null,
        question_title: a.question_title,
        answer_value: a.answer_value,
        answer_label: a.answer_label,
        score: a.score,
      })),
    );
  }

  return NextResponse.json({ ok: true, id: session.id, score });
}

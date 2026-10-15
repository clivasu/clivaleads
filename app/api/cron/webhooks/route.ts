import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { processDueDeliveries } from "@/lib/integrations/webhook-outbox";

// Reenvio periódico de webhooks com falha (Vercel Cron, ver vercel.json).
// A Vercel manda "Authorization: Bearer <CRON_SECRET>"; sem a variável, nada roda.
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, processed: 0 });
  const processed = await processDueDeliveries(createAdminClient(), 25);
  return NextResponse.json({ ok: true, processed });
}

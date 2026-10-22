import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { bookingSlotsSchema } from "@/lib/security/validation";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { computeSlots } from "@/lib/booking/slots";
import { clampRange, loadBookingContext, loadBusy } from "@/lib/booking/server";

// Horários livres para o bloco "Agendamento" (funil público, sem login).
// Não expõe pacientes nem quem está ocupado: só os horários disponíveis.
export async function GET(request: NextRequest) {
  const hdrs = await headers();
  if (!rateLimit(`booking-slots:${clientIp(hdrs)}`, 60)) return NextResponse.json({ ok: false }, { status: 429 });
  const v = bookingSlotsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!v.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, demo: true, days: [] });

  const ctx = await loadBookingContext(v.data.flow_id, v.data.step_id);
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const now = new Date();
  const range = clampRange(v.data.from, v.data.days, ctx.settings, now);
  const busy = range.from <= range.to ? await loadBusy(ctx, range.from, range.to) : [];
  const days = range.from <= range.to
    ? computeSlots({ settings: ctx.settings, from: range.from, to: range.to, duration: ctx.duration, professionals: ctx.professionals.map((p) => p.id), busy, now })
    : [];

  return NextResponse.json(
    {
      ok: true,
      procedure: ctx.procedure,
      duration: ctx.duration,
      max_days_ahead: ctx.settings.max_days_ahead,
      no_professionals: ctx.professionals.length === 0,
      // só o horário: quem atende é escolhido no servidor ao confirmar
      days: days.map((d) => ({ date: d.date, weekday: d.weekday, closed: d.closed, slots: d.slots.map((s) => s.time) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

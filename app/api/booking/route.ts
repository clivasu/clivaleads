import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { getBillingStateAdmin } from "@/lib/data/billing";
import { bookingCreateSchema, readJsonLimited } from "@/lib/security/validation";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { issueLeadToken, verifyLeadToken } from "@/lib/security/lead-token";
import { isOfferedSlot, localToUtc } from "@/lib/booking/slots";
import { linkLead, loadBookingContext, loadBusy } from "@/lib/booking/server";

// Confirma um agendamento feito pelo paciente no bloco "Agendamento".
// - O horário é conferido de novo aqui (regras da clínica + agenda atual).
// - Profissional e duração vêm do bloco/Agenda, nunca do navegador.
// - booking_ref torna o pedido idempotente; a restrição do banco impede
//   dois agendamentos no mesmo horário mesmo em pedidos simultâneos.

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export async function POST(request: NextRequest) {
  const hdrs = await headers();
  if (!rateLimit(`booking:${clientIp(hdrs)}`, 8)) return fail(429, "rate_limited");
  const parsed = await readJsonLimited(request);
  if (!parsed.ok) return fail(parsed.status, "invalid_request");
  const v = bookingCreateSchema.safeParse(parsed.data);
  if (!v.success) return fail(400, "invalid_request");
  const b = v.data;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, demo: true, id: "demo-booking", token: null, date: b.date, time: b.time, professional: "Equipe da clínica" });
  }

  const ctx = await loadBookingContext(b.flow_id, b.step_id);
  if ("error" in ctx) return fail(ctx.status, ctx.error);
  if (!ctx.settings.enabled) return fail(403, "booking_disabled");
  const billing = await getBillingStateAdmin(ctx.orgId);
  if (billing.enabled && !billing.hasAccess) return fail(402, "subscription_inactive");

  const proName = (id: string) => ctx.professionals.find((p) => p.id === id)?.name ?? "Equipe da clínica";

  // Reenvio do mesmo pedido: devolve o agendamento já criado.
  const { data: existing } = await ctx.db
    .from("schedule_appointments")
    .select("id, professional_id, starts_at")
    .eq("organization_id", ctx.orgId)
    .eq("booking_ref", b.booking_ref)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, id: existing.id, token: issueLeadToken(`booking:${existing.id}`), date: b.date, time: b.time, professional: proName(existing.professional_id as string) });
  }

  const now = new Date();
  const busy = await loadBusy(ctx, b.date, b.date);
  const free = isOfferedSlot({ settings: ctx.settings, from: b.date, to: b.date, date: b.date, time: b.time, duration: ctx.duration, professionals: ctx.professionals.map((p) => p.id), busy, now });
  if (free.length === 0) return fail(409, "slot_taken");

  // Paciente: reaproveita pelo telefone na mesma clínica.
  const phone = b.phone;
  let patientId: string | null = null;
  const { data: pat } = await ctx.db.from("schedule_patients").select("id").eq("organization_id", ctx.orgId).eq("phone", phone).limit(1).maybeSingle();
  if (pat) patientId = pat.id as string;
  else {
    const { data: created } = await ctx.db
      .from("schedule_patients")
      .insert({ organization_id: ctx.orgId, name: b.name, phone, notes: `Cadastrada pelo agendamento online${b.email ? ` · ${b.email}` : ""}` })
      .select("id")
      .single();
    patientId = (created?.id as string) ?? null;
  }

  const start = localToUtc(b.date, b.time);
  const end = new Date(start.getTime() + ctx.duration * 60000);
  let appointment: { id: string; professional_id: string } | null = null;
  for (const professional_id of free) {
    const { data, error } = await ctx.db
      .from("schedule_appointments")
      .insert({
        organization_id: ctx.orgId, professional_id, patient_id: patientId, patient_name: b.name,
        procedure_name: ctx.procedure, starts_at: start.toISOString(), ends_at: end.toISOString(),
        status: ctx.settings.auto_confirm ? "confirmed" : "registered",
        source: "funnel", flow_id: ctx.flowId, booking_ref: b.booking_ref,
        notes: `Agendado online pelo funil "${ctx.flowName}"`,
      })
      .select("id, professional_id")
      .single();
    if (data) { appointment = data as { id: string; professional_id: string }; break; }
    // 23P01: alguém ocupou este horário agora; tenta o próximo profissional livre.
    if (error?.code === "23505") {
      const { data: dup } = await ctx.db.from("schedule_appointments").select("id, professional_id").eq("organization_id", ctx.orgId).eq("booking_ref", b.booking_ref).maybeSingle();
      if (dup) { appointment = dup as { id: string; professional_id: string }; break; }
    }
    if (error && error.code !== "23P01") {
      console.error("[booking] falha ao agendar", error.code);
      return fail(500, "save_failed");
    }
  }
  if (!appointment) return fail(409, "slot_taken");

  // Lead já gravado antes do agendamento: marca como agendado e liga os dois.
  if (b.lead && verifyLeadToken(b.lead.id, b.lead.token)) {
    await linkLead(ctx.db, ctx.orgId, b.lead.id, appointment.id);
  }

  const wd = WD[new Date(`${b.date}T12:00:00Z`).getUTCDay()];
  await ctx.db.from("notifications").insert({
    organization_id: ctx.orgId,
    type: "booking.created",
    title: `Novo agendamento: ${b.name}`.slice(0, 160),
    body: `${ctx.procedure} · ${wd} ${b.date.slice(8, 10)}/${b.date.slice(5, 7)} às ${b.time} · ${proName(appointment.professional_id)} · funil "${ctx.flowName}"`.slice(0, 500),
    link: `/schedule?data=${b.date}`,
    appointment_id: appointment.id,
  });

  return NextResponse.json({
    ok: true, id: appointment.id, token: issueLeadToken(`booking:${appointment.id}`),
    date: b.date, time: b.time, duration: ctx.duration, procedure: ctx.procedure, professional: proName(appointment.professional_id),
    status: ctx.settings.auto_confirm ? "confirmed" : "registered",
  });
}

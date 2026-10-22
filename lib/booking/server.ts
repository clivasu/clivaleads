import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { StepConfig } from "@/lib/types";
import { addDays, brToday, normalizeBookingSettings, type BookingSettings, type Busy } from "./slots";

// Contexto do bloco "Agendamento" de um funil publicado. Usa service role
// (o paciente não tem login), mas tudo é derivado do funil: o navegador só
// informa funil + bloco, nunca clínica, profissional ou duração.

type Admin = ReturnType<typeof createAdminClient>;

export interface BookingContext {
  db: Admin;
  orgId: string;
  orgSlug: string;
  flowId: string;
  flowName: string;
  config: StepConfig;
  settings: BookingSettings;
  procedure: string;
  duration: number;
  professionals: { id: string; name: string }[];
}

// Bloco pode estar aninhado (seção/hero guardam filhos em config.__children).
function findStep(rows: { id: string; type: string; config: Record<string, unknown> }[], stepId: string): StepConfig | null {
  const walk = (list: { id: string; type: string; config?: Record<string, unknown> }[]): StepConfig | null => {
    for (const s of list) {
      if (s.id === stepId && s.type === "booking") return (s.config ?? {}) as StepConfig;
      const kids = (s.config?.__children ?? (s as { children?: unknown }).children) as typeof list | undefined;
      if (Array.isArray(kids)) { const hit = walk(kids); if (hit) return hit; }
    }
    return null;
  };
  return walk(rows);
}

export async function loadBookingContext(flowId: string, stepId: string): Promise<BookingContext | { error: string; status: number }> {
  const db = createAdminClient();
  const { data: flow } = await db
    .from("flows")
    .select("id, name, organization_id, organization:organizations(slug), steps:flow_steps(id, type, config)")
    .eq("id", flowId)
    .eq("status", "published")
    .maybeSingle();
  if (!flow) return { error: "flow_not_found", status: 404 };
  const config = findStep((flow.steps ?? []) as never, stepId);
  if (!config) return { error: "step_not_found", status: 404 };
  const orgId = flow.organization_id as string;

  const [{ data: settingsRow }, { data: pros }, { data: procs }] = await Promise.all([
    db.from("schedule_booking_settings").select("settings").eq("organization_id", orgId).maybeSingle(),
    db.from("schedule_professionals").select("id, name").eq("organization_id", orgId).eq("active", true).order("created_at"),
    db.from("schedule_procedures").select("name, duration_min").eq("organization_id", orgId),
  ]);
  const settings = normalizeBookingSettings(settingsRow?.settings);
  const procedure = (config.booking_procedure ?? "").trim() || "Avaliação";
  const proc = (procs ?? []).find((p) => (p.name as string).toLowerCase() === procedure.toLowerCase());
  const duration = Math.min(720, Math.max(5, Number(config.booking_duration) || Number(proc?.duration_min) || 60));
  const all = (pros ?? []) as { id: string; name: string }[];
  const wanted = config.booking_professional && config.booking_professional !== "any" ? all.filter((p) => p.id === config.booking_professional) : all;
  const org = (Array.isArray(flow.organization) ? flow.organization[0] : flow.organization) as { slug: string } | null;

  return {
    db, orgId, orgSlug: org?.slug ?? "", flowId: flow.id as string, flowName: flow.name as string,
    config, settings, procedure, duration, professionals: wanted,
  };
}

// Horários ocupados (não cancelados) dos profissionais no intervalo de datas.
export async function loadBusy(ctx: BookingContext, from: string, to: string): Promise<Busy[]> {
  if (ctx.professionals.length === 0) return [];
  const { data } = await ctx.db
    .from("schedule_appointments")
    .select("professional_id, starts_at, ends_at")
    .eq("organization_id", ctx.orgId)
    .in("professional_id", ctx.professionals.map((p) => p.id))
    .neq("status", "cancelled")
    .lt("starts_at", new Date(`${addDays(to, 1)}T03:00:00Z`).toISOString())
    .gt("ends_at", new Date(`${from}T03:00:00Z`).toISOString())
    .limit(2000);
  return (data ?? []).map((a) => ({ professional_id: a.professional_id as string, start: new Date(a.starts_at as string), end: new Date(a.ends_at as string) }));
}

export function clampRange(from: string, days: number, settings: BookingSettings, now: Date): { from: string; to: string } {
  const today = brToday(now);
  const start = from < today ? today : from;
  const last = addDays(today, settings.max_days_ahead);
  const end = addDays(start, days - 1);
  return { from: start, to: end > last ? last : end };
}

// Liga agendamento e lead: o lead vira "agendado" (o banco registra o evento
// appointment_booked) sem rebaixar quem a clínica já marcou como convertido.
export async function linkLead(db: Admin, orgId: string, leadId: string, appointmentId: string) {
  await db.from("schedule_appointments").update({ lead_session_id: leadId }).eq("id", appointmentId).eq("organization_id", orgId).is("lead_session_id", null);
  await db.from("lead_sessions").update({ status: "scheduled" }).eq("id", leadId).eq("organization_id", orgId).in("status", ["new", "qualified", "whatsapp", "lost"]);
}

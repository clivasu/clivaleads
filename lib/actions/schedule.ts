"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import { toTimestamp } from "@/lib/schedule-time";
import { initialsFrom } from "@/lib/demo-schedule";

// Agenda (0012). Tudo pelo cliente do usuário: a RLS garante que só membros
// da clínica leem e alteram. Horários em Brasília (lib/schedule-time.ts).

export interface ScheduleResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(120);
const STATUSES = ["registered", "confirmed", "in_progress", "done", "cancelled"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hour = z.number().min(0).max(24);

function friendly(e: { code?: string; message: string }): string {
  if (e.code === "23P01") return "Esse horário já está ocupado para este profissional.";
  if (e.code === "23505") return "Já existe um cadastro com esse nome.";
  if (e.code === "23514") return "Dados inválidos (confira horário e duração).";
  if (e.code === "23503") return "Profissional não encontrado nesta clínica.";
  return "Não foi possível salvar na agenda. Tente de novo.";
}

async function ctx() {
  if (!isSupabaseConfigured) return null;
  const org = await getCurrentOrg();
  if (!org) return null;
  return { org, supabase: await createClient() };
}

const done = (id?: string): ScheduleResult => {
  revalidatePath("/schedule");
  return { ok: true, id };
};

/* ------------------------------ profissionais ----------------------------- */
export async function addProfessional(input: { id: string; name: string; avatarColor?: string }): Promise<ScheduleResult> {
  const v = z.object({ id: uuid, name, avatarColor: z.string().max(80).optional() }).safeParse(input);
  if (!v.success) return { ok: false, error: "Nome inválido." };
  const c = await ctx();
  if (!c) return { ok: false, error: "Faça login." };
  const { error } = await c.supabase.from("schedule_professionals").insert({
    id: v.data.id, organization_id: c.org.id, name: v.data.name, initials: initialsFrom(v.data.name), avatar_color: v.data.avatarColor ?? null,
  });
  return error ? { ok: false, error: friendly(error) } : done(v.data.id);
}

// Some da tela; atendimentos antigos continuam no histórico.
export async function removeProfessional(id: string): Promise<ScheduleResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Profissional inválido." };
  const c = await ctx();
  if (!c) return { ok: false, error: "Faça login." };
  const { data, error } = await c.supabase.from("schedule_professionals").update({ active: false }).eq("id", id).select("id");
  if (error) return { ok: false, error: friendly(error) };
  return data?.length ? done() : { ok: false, error: "Profissional não encontrado." };
}

/* ------------------------------ procedimentos ----------------------------- */
export async function addProcedure(input: { name: string; color: string }): Promise<ScheduleResult> {
  const v = z.object({ name, color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).safeParse(input);
  if (!v.success) return { ok: false, error: "Procedimento inválido." };
  const c = await ctx();
  if (!c) return { ok: false, error: "Faça login." };
  const { error } = await c.supabase.from("schedule_procedures").insert({ organization_id: c.org.id, name: v.data.name, color: v.data.color });
  return error ? { ok: false, error: friendly(error) } : done();
}

export async function removeProcedure(procName: string): Promise<ScheduleResult> {
  if (!name.safeParse(procName).success) return { ok: false, error: "Procedimento inválido." };
  const c = await ctx();
  if (!c) return { ok: false, error: "Faça login." };
  const { error } = await c.supabase.from("schedule_procedures").delete().eq("organization_id", c.org.id).ilike("name", procName.replace(/[%_]/g, "\\$&"));
  return error ? { ok: false, error: friendly(error) } : done();
}

/* ------------------------------ agendamentos ------------------------------ */
const apptSchema = z.object({
  id: uuid,
  doctorId: uuid,
  patientName: z.string().trim().min(1).max(160),
  procedure: name,
  date,
  start: hour,
  end: hour,
  status: z.enum(STATUSES),
  isReturn: z.boolean(),
  patientId: uuid.optional(),   // paciente escolhido na busca
  leadId: uuid.optional(),      // lead escolhido na busca (vira paciente e fica "agendado")
  phone: z.string().max(40).optional(),
});
export type AppointmentInput = z.infer<typeof apptSchema>;

type Ctx = NonNullable<Awaited<ReturnType<typeof ctx>>>;

async function patientIdFor(c: Ctx, a: { patientName: string; patientId?: string; leadId?: string; phone?: string }): Promise<string | null> {
  // 1) paciente escolhido na busca (precisa ser desta clínica)
  if (a.patientId) {
    const { data } = await c.supabase.from("schedule_patients").select("id").eq("organization_id", c.org.id).eq("id", a.patientId).maybeSingle();
    if (data) return data.id;
  }
  const phone = (a.phone ?? "").replace(/\D/g, "");
  // 2) lead escolhido: reaproveita a ficha ligada ao lead ou com o mesmo telefone
  if (a.leadId) {
    const { data: byLead } = await c.supabase.from("schedule_patients").select("id").eq("organization_id", c.org.id).eq("lead_session_id", a.leadId).limit(1);
    if (byLead?.[0]) return byLead[0].id;
  }
  if (phone.length >= 10) {
    const { data: byPhone } = await c.supabase.from("schedule_patients").select("id").eq("organization_id", c.org.id).eq("phone", phone).limit(1);
    if (byPhone?.[0]) return byPhone[0].id;
  }
  // 3) mesmo nome (comportamento antigo)
  const { data: found } = await c.supabase
    .from("schedule_patients").select("id").eq("organization_id", c.org.id)
    .ilike("name", a.patientName.replace(/[%_]/g, "\\$&")).limit(1);
  if (found?.[0]) return found[0].id;
  // 4) novo paciente (com ligação ao lead quando houver)
  const base: Record<string, unknown> = { organization_id: c.org.id, name: a.patientName, phone: phone || null };
  const first = await c.supabase.from("schedule_patients")
    .insert(a.leadId ? { ...base, lead_session_id: a.leadId, source: "Funil da Cliva" } : base).select("id").single();
  if (first.data) return first.data.id;
  if (!a.leadId) return null;
  const retry = await c.supabase.from("schedule_patients").insert(base).select("id").single(); // banco sem a 0019
  return retry.data?.id ?? null;
}

// Cria ou atualiza (mesmo id). O banco recusa sobreposição de horário.
export async function saveAppointment(input: AppointmentInput): Promise<ScheduleResult> {
  const v = apptSchema.safeParse(input);
  if (!v.success || v.data.end <= v.data.start) return { ok: false, error: "Horário inválido." };
  const c = await ctx();
  if (!c) return { ok: false, error: "Faça login." };
  const a = v.data;
  const patient_id = await patientIdFor(c, a);
  const { error } = await c.supabase.from("schedule_appointments").upsert({
    id: a.id,
    organization_id: c.org.id,
    professional_id: a.doctorId,
    patient_id,
    patient_name: a.patientName,
    procedure_name: a.procedure,
    starts_at: toTimestamp(a.date, a.start),
    ends_at: toTimestamp(a.date, a.end),
    status: a.status,
    is_return: a.isReturn,
    ...(a.leadId ? { lead_session_id: a.leadId } : {}),
  }, { onConflict: "id" });
  if (error) return { ok: false, error: friendly(error) };
  // Lead agendado: sai da lista de "a agendar" e conta como agendamento.
  if (a.leadId) {
    await c.supabase.from("lead_sessions").update({ status: "scheduled" }).eq("id", a.leadId).eq("organization_id", c.org.id).in("status", ["new", "qualified", "whatsapp", "lost"]);
    revalidatePath("/leads");
  }
  return done(a.id);
}

export async function deleteAppointment(id: string): Promise<ScheduleResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Agendamento inválido." };
  const c = await ctx();
  if (!c) return { ok: false, error: "Faça login." };
  const { data, error } = await c.supabase.from("schedule_appointments").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: friendly(error) };
  return data?.length ? done() : { ok: false, error: "Agendamento não encontrado." };
}

/* ------------------------ importação do navegador ------------------------- */
// Dados que a agenda antiga guardava no localStorage. Importação manual, com
// confirmação na tela; nada é apagado do navegador automaticamente.
const legacySchema = z.object({
  docs: z.array(z.object({ id: z.string().max(80), name: z.string().trim().min(1).max(120), avatarColor: z.string().max(80).optional() })).max(200),
  procs: z.array(z.object({ name: z.string().trim().min(1).max(120), color: z.string().max(9) })).max(200),
  patients: z.array(z.object({ id: z.string().max(80), name: z.string().trim().min(1).max(160), phone: z.string().max(40).optional() })).max(5000),
  appts: z.array(z.object({
    doctorId: z.string().max(80), patientId: z.string().max(80), procedure: z.string().trim().min(1).max(120),
    date, start: hour, end: hour, status: z.enum(STATUSES), isReturn: z.boolean().optional(),
  })).max(5000),
});
export type LegacySchedule = z.infer<typeof legacySchema>;

export interface ImportSummary {
  ok: boolean;
  error?: string;
  professionals: number;
  procedures: number;
  appointments: number;
  skippedDuplicates: number;
  skippedConflicts: number;
  skippedInvalid: number;
}

export async function importLocalSchedule(payload: LegacySchedule): Promise<ImportSummary> {
  const empty = { professionals: 0, procedures: 0, appointments: 0, skippedDuplicates: 0, skippedConflicts: 0, skippedInvalid: 0 };
  const v = legacySchema.safeParse(payload);
  if (!v.success) return { ok: false, error: "Dados do navegador em formato inesperado.", ...empty };
  const c = await ctx();
  if (!c) return { ok: false, error: "Faça login.", ...empty };
  const s = { ...empty };
  const key = (x: string) => x.trim().toLowerCase();

  // Profissionais: reaproveita os que já existem pelo nome.
  const { data: profRows } = await c.supabase.from("schedule_professionals").select("id, name").eq("organization_id", c.org.id).eq("active", true);
  const profByName = new Map((profRows ?? []).map((p) => [key(p.name), p.id as string]));
  const profByLocalId = new Map<string, string>();
  for (const d of v.data.docs) {
    let id = profByName.get(key(d.name));
    if (!id) {
      const { data } = await c.supabase.from("schedule_professionals")
        .insert({ organization_id: c.org.id, name: d.name, initials: initialsFrom(d.name), avatar_color: d.avatarColor ?? null }).select("id").single();
      if (data) { id = data.id; profByName.set(key(d.name), data.id); s.professionals++; }
    }
    if (id) profByLocalId.set(d.id, id);
  }

  // Procedimentos.
  const { data: procRows } = await c.supabase.from("schedule_procedures").select("name").eq("organization_id", c.org.id);
  const procNames = new Set((procRows ?? []).map((p) => key(p.name)));
  for (const p of v.data.procs) {
    if (procNames.has(key(p.name))) continue;
    const color = /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#64748b";
    const { error } = await c.supabase.from("schedule_procedures").insert({ organization_id: c.org.id, name: p.name, color });
    if (!error) { procNames.add(key(p.name)); s.procedures++; }
  }

  // Agendamentos: pula duplicados (mesmo profissional, horário e paciente) e
  // conflitos de horário; cada um é contado no resumo.
  const patientName = new Map(v.data.patients.map((p) => [p.id, p.name]));
  const { data: existing } = await c.supabase.from("schedule_appointments")
    .select("professional_id, starts_at, patient_name").eq("organization_id", c.org.id).limit(10000);
  const seen = new Set((existing ?? []).map((e) => `${e.professional_id}|${new Date(e.starts_at).toISOString()}|${key(e.patient_name)}`));
  for (const a of v.data.appts) {
    const prof = profByLocalId.get(a.doctorId);
    const pName = patientName.get(a.patientId);
    if (!prof || !pName || a.end <= a.start) { s.skippedInvalid++; continue; }
    const starts_at = toTimestamp(a.date, a.start);
    const dedupe = `${prof}|${starts_at}|${key(pName)}`;
    if (seen.has(dedupe)) { s.skippedDuplicates++; continue; }
    const patient_id = await patientIdFor(c, { patientName: pName });
    const { error } = await c.supabase.from("schedule_appointments").insert({
      organization_id: c.org.id, professional_id: prof, patient_id, patient_name: pName, procedure_name: a.procedure,
      starts_at, ends_at: toTimestamp(a.date, a.end), status: a.status, is_return: a.isReturn ?? false,
    });
    if (error?.code === "23P01") { s.skippedConflicts++; continue; }
    if (error) { s.skippedInvalid++; continue; }
    seen.add(dedupe);
    s.appointments++;
  }

  revalidatePath("/schedule");
  return { ok: true, ...s };
}

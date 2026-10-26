import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { fromTimestamp } from "@/lib/schedule-time";
import { AVATAR_COLORS, initialsFrom, type Appt, type Doctor, type LeadPick, type Patient, type Procedure, type Status } from "@/lib/demo-schedule";
import { cleanAnamnesis, healthAlerts } from "@/lib/patients";

// Agenda da clínica vinda do banco (0012), no formato que a tela já usa.
export interface ScheduleData {
  available: boolean; // false = tabelas ainda não existem (migration 0012 pendente)
  docs: Doctor[];
  procs: Procedure[];
  patients: Patient[];
  appts: Appt[];
  leads: LeadPick[]; // leads recentes ainda não agendados
}

const EMPTY: ScheduleData = { available: false, docs: [], procs: [], patients: [], appts: [], leads: [] };
const missing = (code?: string) => code === "42P01" || code === "PGRST205";

export async function getScheduleData(orgId: string): Promise<ScheduleData> {
  if (!isSupabaseConfigured) return EMPTY;
  const supabase = await createClient();
  // Janela carregada: 90 dias para trás e 1 ano para frente.
  const from = new Date(Date.now() - 90 * 86400000).toISOString();
  const to = new Date(Date.now() + 365 * 86400000).toISOString();

  const [profs, procs, pats, appts, leads] = await Promise.all([
    supabase.from("schedule_professionals").select("id, name, initials, avatar_color, active").eq("organization_id", orgId).order("created_at"),
    supabase.from("schedule_procedures").select("*").eq("organization_id", orgId).order("created_at"),
    supabase.from("schedule_patients").select("*").eq("organization_id", orgId).order("name").limit(5000),
    supabase.from("schedule_appointments")
      .select("id, professional_id, patient_id, patient_name, procedure_name, starts_at, ends_at, status, is_return")
      .eq("organization_id", orgId).gte("starts_at", from).lte("starts_at", to).order("starts_at").limit(3000),
    supabase.from("lead_sessions").select("id, name, phone, procedure, score, created_at")
      .eq("organization_id", orgId).in("status", ["new", "qualified", "whatsapp"]).not("name", "is", null)
      .order("created_at", { ascending: false }).limit(300),
  ]);
  if ([profs, procs, pats, appts].some((r) => r.error && missing(r.error.code))) return EMPTY;

  // tags = alertas de saúde da ficha (alergia, gestante…), mostrados na Agenda.
  const patients: Patient[] = ((pats.data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: p.id as string, name: p.name as string, phone: (p.phone as string) ?? "", age: 0, gender: "F", since: String(p.created_at).slice(0, 10),
    tags: healthAlerts(cleanAnamnesis(p.anamnesis)), notes: (p.notes as string) ?? "", history: [],
  }));
  const apptRows = appts.data ?? [];
  // Agendamento sem paciente vinculado (ex.: paciente removido): paciente só de exibição.
  for (const a of apptRows) {
    if (!a.patient_id) patients.push({ id: `nome:${a.id}`, name: a.patient_name, phone: "", age: 0, gender: "F", since: "", tags: [], notes: "", history: [] });
  }

  return {
    available: true,
    docs: (profs.data ?? []).filter((d) => d.active).map((d, i) => ({
      id: d.id, name: d.name, initials: d.initials || initialsFrom(d.name), avatarColor: d.avatar_color || AVATAR_COLORS[i % AVATAR_COLORS.length],
    })),
    procs: ((procs.data ?? []) as { name: string; color: string; duration_min?: number }[]).map((p) => ({ name: p.name, color: p.color, duration: p.duration_min })),
    leads: ((leads.data ?? []) as { id: string; name: string | null; phone: string | null; procedure: string | null; score: number; created_at: string }[])
      .filter((l) => l.name).map((l) => ({ id: l.id, name: l.name!, phone: l.phone ?? "", procedure: l.procedure, score: l.score ?? 0, created_at: l.created_at })),
    patients,
    appts: apptRows.map((a) => {
      const s = fromTimestamp(a.starts_at);
      const e = fromTimestamp(a.ends_at);
      return {
        id: a.id, doctorId: a.professional_id, patientId: a.patient_id ?? `nome:${a.id}`, procedure: a.procedure_name,
        date: s.date, start: s.hour, end: e.date === s.date ? e.hour : s.hour + (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 3600000,
        status: a.status as Status, isReturn: a.is_return,
      };
    }),
  };
}

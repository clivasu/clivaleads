import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { cleanAnamnesis, healthAlerts, onlyDigits, type Anamnesis } from "@/lib/patients";

// Fichas de pacientes (schedule_patients + 0019). RLS: membros da clínica.

export interface PatientRow {
  id: string; name: string; phone: string | null; cpf: string | null; birth_date: string | null;
  created_at: string; alerts: string[]; visits: number; last_visit: string | null; next_visit: string | null;
}

export interface PatientRecord {
  id: string; name: string; phone: string | null; cpf: string | null; rg: string | null; birth_date: string | null;
  gender: string | null; email: string | null; occupation: string | null; source: string | null; notes: string | null;
  address: Record<string, string>; emergency_contact: Record<string, string>; anamnesis: Anamnesis;
  consent_at: string | null; created_at: string; updated_at: string | null; lead_session_id: string | null;
}

export interface PatientVisit {
  id: string; starts_at: string; ends_at: string; procedure: string; professional: string; status: string;
  is_return: boolean; price_cents: number | null; source: string | null;
}

export interface PatientLead {
  id: string; created_at: string; flow_name: string | null; procedure: string | null; score: number; status: string;
  utm_source: string | null; answers: { question_title: string; answer_label: string }[];
}

export interface PatientChartData {
  record: PatientRecord;
  visits: PatientVisit[];
  lead: PatientLead | null;
  extended: boolean; // false = banco sem a 0019 (só nome/telefone/observações)
}

export const PATIENTS_PAGE = 30;

export async function listPatients(orgId: string, q = "", page = 1): Promise<{ rows: PatientRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createClient();
  const p = Math.max(1, page);
  let query = supabase.from("schedule_patients").select("*", { count: "exact" }).eq("organization_id", orgId);
  const term = q.trim().slice(0, 80);
  if (term) {
    const digits = onlyDigits(term);
    const safe = term.replace(/[%_,()]/g, " ");
    query = digits.length >= 3
      ? query.or(`name.ilike.%${safe}%,phone.ilike.%${digits}%,cpf.ilike.%${digits}%`)
      : query.ilike("name", `%${safe}%`);
  }
  let { data, count, error } = await query.order("name").range((p - 1) * PATIENTS_PAGE, p * PATIENTS_PAGE - 1);
  // Banco sem a 0019 (sem coluna cpf): busca só por nome/telefone.
  if (error && term) {
    ({ data, count, error } = await supabase.from("schedule_patients").select("*", { count: "exact" }).eq("organization_id", orgId)
      .ilike("name", `%${term.replace(/[%_,()]/g, " ")}%`).order("name").range((p - 1) * PATIENTS_PAGE, p * PATIENTS_PAGE - 1));
  }
  const pats = (data ?? []) as Record<string, unknown>[];
  const ids = pats.map((x) => x.id as string);
  const stats = new Map<string, { visits: number; last: string | null; next: string | null }>();
  if (ids.length) {
    const { data: ap } = await supabase.from("schedule_appointments").select("patient_id, starts_at, status")
      .eq("organization_id", orgId).in("patient_id", ids).neq("status", "cancelled").order("starts_at").limit(5000);
    const now = new Date().toISOString();
    for (const a of ap ?? []) {
      const s = stats.get(a.patient_id as string) ?? { visits: 0, last: null, next: null };
      if ((a.starts_at as string) < now) { if (a.status === "done") s.visits++; s.last = a.starts_at as string; }
      else if (!s.next) s.next = a.starts_at as string;
      stats.set(a.patient_id as string, s);
    }
  }
  return {
    total: count ?? 0,
    rows: pats.map((x) => {
      const s = stats.get(x.id as string);
      return {
        id: x.id as string, name: x.name as string, phone: (x.phone as string) ?? null, cpf: (x.cpf as string) ?? null,
        birth_date: (x.birth_date as string) ?? null, created_at: x.created_at as string,
        alerts: healthAlerts(cleanAnamnesis(x.anamnesis)), visits: s?.visits ?? 0, last_visit: s?.last ?? null, next_visit: s?.next ?? null,
      };
    }),
  };
}

export async function getPatientChart(orgId: string, id: string): Promise<PatientChartData | null> {
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: p } = await supabase.from("schedule_patients").select("*").eq("organization_id", orgId).eq("id", id).maybeSingle();
  if (!p) return null;
  const r = p as Record<string, unknown>;
  const record: PatientRecord = {
    id: r.id as string, name: r.name as string, phone: (r.phone as string) ?? null, cpf: (r.cpf as string) ?? null,
    rg: (r.rg as string) ?? null, birth_date: (r.birth_date as string) ?? null, gender: (r.gender as string) ?? null,
    email: (r.email as string) ?? null, occupation: (r.occupation as string) ?? null, source: (r.source as string) ?? null,
    notes: (r.notes as string) ?? null, address: (r.address as Record<string, string>) ?? {},
    emergency_contact: (r.emergency_contact as Record<string, string>) ?? {}, anamnesis: cleanAnamnesis(r.anamnesis),
    consent_at: (r.consent_at as string) ?? null, created_at: r.created_at as string, updated_at: (r.updated_at as string) ?? null,
    lead_session_id: (r.lead_session_id as string) ?? null,
  };

  const [{ data: ap }, { data: pros }, { data: procs }] = await Promise.all([
    supabase.from("schedule_appointments").select("*").eq("organization_id", orgId).eq("patient_id", id).order("starts_at", { ascending: false }).limit(500),
    supabase.from("schedule_professionals").select("id, name").eq("organization_id", orgId),
    supabase.from("schedule_procedures").select("*").eq("organization_id", orgId),
  ]);
  const proName = new Map((pros ?? []).map((x) => [x.id as string, x.name as string]));
  const price = new Map((procs ?? []).map((x) => [String(x.name).toLowerCase(), (x as { price_cents?: number }).price_cents ?? null]));
  const visits: PatientVisit[] = ((ap ?? []) as Record<string, unknown>[]).map((a) => ({
    id: a.id as string, starts_at: a.starts_at as string, ends_at: a.ends_at as string, procedure: a.procedure_name as string,
    professional: proName.get(a.professional_id as string) ?? "—", status: a.status as string, is_return: Boolean(a.is_return),
    price_cents: price.get(String(a.procedure_name).toLowerCase()) ?? null, source: (a.source as string) ?? null,
  }));

  // Origem: lead ligado à ficha ou, na falta, o lead mais recente com o mesmo telefone.
  let leadRow: Record<string, unknown> | null = null;
  const cols = "id, created_at, procedure, score, status, utm_source, phone, flow:flows(name), answers:lead_answers(question_title, answer_label)";
  if (record.lead_session_id) {
    ({ data: leadRow } = await supabase.from("lead_sessions").select(cols).eq("id", record.lead_session_id).maybeSingle());
  }
  if (!leadRow && record.phone && record.phone.length >= 10) {
    const tail = record.phone.slice(-9);
    const { data } = await supabase.from("lead_sessions").select(cols).eq("organization_id", orgId).ilike("phone", `%${tail}`).order("created_at", { ascending: false }).limit(1);
    leadRow = (data?.[0] as Record<string, unknown>) ?? null;
  }
  const flow = leadRow ? (Array.isArray(leadRow.flow) ? leadRow.flow[0] : leadRow.flow) as { name?: string } | null : null;
  const lead: PatientLead | null = leadRow ? {
    id: leadRow.id as string, created_at: leadRow.created_at as string, flow_name: flow?.name ?? null,
    procedure: (leadRow.procedure as string) ?? null, score: Number(leadRow.score) || 0, status: leadRow.status as string,
    utm_source: (leadRow.utm_source as string) ?? null, answers: (leadRow.answers as PatientLead["answers"]) ?? [],
  } : null;

  return { record, visits, lead, extended: "anamnesis" in r };
}

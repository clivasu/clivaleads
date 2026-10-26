"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import { patientSchema, type PatientInput } from "@/lib/patients";

// Salva a ficha do paciente (cria se não tiver id). RLS: membros da clínica.
export async function savePatient(input: PatientInput): Promise<{ ok: boolean; id?: string; error?: string; field?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Conecte o Supabase para salvar." };
  const v = patientSchema.safeParse(input);
  if (!v.success) {
    const issue = v.error.issues[0];
    return { ok: false, error: issue?.message ?? "Dados inválidos.", field: String(issue?.path?.[0] ?? "") };
  }
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login." };
  const supabase = await createClient();
  const { id, consent, ...p } = v.data;

  let consent_at: string | null | undefined;
  if (id) {
    const { data: cur } = await supabase.from("schedule_patients").select("consent_at").eq("id", id).maybeSingle();
    consent_at = consent ? ((cur as { consent_at?: string } | null)?.consent_at ?? new Date().toISOString()) : null;
  } else consent_at = consent ? new Date().toISOString() : null;

  const row = { ...p, consent_at, organization_id: org.id };
  const q = id
    ? supabase.from("schedule_patients").update(row).eq("id", id).eq("organization_id", org.id).select("id")
    : supabase.from("schedule_patients").insert(row).select("id");
  const { data, error } = await q;
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um paciente com este CPF nesta clínica.", field: "cpf" };
    if (error.code === "42703" || error.code === "PGRST204") return { ok: false, error: "A ficha completa precisa da atualização do banco (migration 0019)." };
    return { ok: false, error: "Não foi possível salvar a ficha." };
  }
  const newId = (data?.[0] as { id?: string } | undefined)?.id ?? id;
  if (!newId) return { ok: false, error: "Paciente não encontrado." };
  revalidatePath("/patients");
  revalidatePath(`/patients/${newId}`);
  revalidatePath("/schedule");
  return { ok: true, id: newId };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import { deleteLead, updateLead, type LeadPatch } from "@/lib/data/leads";

export interface LeadActionResult {
  ok: boolean;
  error?: string;
}

export async function deleteLeadAction(id: string): Promise<LeadActionResult> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "no-org" };
  const ok = await deleteLead(id);
  revalidatePath("/leads");
  return { ok, error: ok ? undefined : "delete-failed" };
}

export async function updateLeadAction(id: string, patch: LeadPatch): Promise<LeadActionResult> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "no-org" };
  const ok = await updateLead(id, patch);
  revalidatePath("/leads");
  return { ok, error: ok ? undefined : "update-failed" };
}

const manualLeadSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  phone: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length >= 10 && v.length <= 13, "Telefone com DDD"),
  email: z.union([z.string().trim().email("E-mail inválido").max(200), z.literal("")]).optional(),
  procedure: z.string().trim().max(200).optional(),
  source: z.string().trim().max(60).optional(),
  interest: z.enum(["hot", "warm", "cold"]).default("warm"),
  status: z.enum(["new", "qualified", "whatsapp", "scheduled", "converted", "lost"]).default("new"),
  notes: z.string().trim().max(2000).optional(),
  createPatient: z.boolean().default(false),
});
export type ManualLeadInput = z.input<typeof manualLeadSchema>;

// Lead cadastrado pela equipe (indicação, ligação, balcão…). Fica fora das
// métricas dos funis; a RLS só aceita source = 'manual' sem funil.
export async function createManualLead(input: ManualLeadInput): Promise<LeadActionResult & { id?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Conecte o Supabase para salvar." };
  const v = manualLeadSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Dados inválidos." };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login." };
  const d = v.data;
  const supabase = await createClient();
  const score = d.interest === "hot" ? 80 : d.interest === "warm" ? 45 : 15;
  const { data, error } = await supabase.from("lead_sessions").insert({
    session_id: `manual-${crypto.randomUUID()}`, organization_id: org.id, flow_id: null, source: "manual",
    name: d.name, phone: d.phone, email: d.email || null, procedure: d.procedure || null, score, status: d.status,
    utm_source: d.source || null, notes: d.notes || null, device: null,
  }).select("id").single();
  if (error || !data) {
    if (error?.code === "42703" || error?.code === "PGRST204" || error?.code === "23502") return { ok: false, error: "Cadastro manual disponível depois da atualização do banco (migration 0019)." };
    return { ok: false, error: "Não foi possível cadastrar o lead." };
  }
  if (d.createPatient) {
    const { data: found } = await supabase.from("schedule_patients").select("id").eq("organization_id", org.id).eq("phone", d.phone).limit(1);
    if (!found?.length) {
      await supabase.from("schedule_patients").insert({ organization_id: org.id, name: d.name, phone: d.phone, email: d.email || null, source: d.source || null, lead_session_id: data.id });
    }
  }
  revalidatePath("/leads");
  revalidatePath("/patients");
  return { ok: true, id: data.id };
}

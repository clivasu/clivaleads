"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import { normalizeBookingSettings, type BookingSettings } from "@/lib/booking/slots";

// Agendamento online (Configurações) e notificações do topo do painel.
// RLS: regras só owner/admin gravam; notificações qualquer membro lê/marca.

export async function saveBookingSettings(input: BookingSettings): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Conecte o Supabase para salvar." };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login." };
  const settings = normalizeBookingSettings(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_booking_settings")
    .upsert({ organization_id: org.id, settings, updated_at: new Date().toISOString() }, { onConflict: "organization_id" })
    .select("organization_id");
  if (error || !data?.length) return { ok: false, error: error?.code === "42501" || !data?.length ? "Só a dona ou administradores da clínica alteram estas regras." : "Não foi possível salvar." };
  revalidatePath("/settings");
  return { ok: true };
}

const procSchema = z.object({
  name: z.string().trim().min(1).max(120),
  duration_min: z.number().int().min(5).max(720),
  price: z.number().min(0).max(1_000_000).nullable(),
});

export async function saveProcedureDetails(list: z.infer<typeof procSchema>[]): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Conecte o Supabase para salvar." };
  const v = z.array(procSchema).max(100).safeParse(list);
  if (!v.success) return { ok: false, error: "Valores inválidos: duração de 5 a 720 minutos." };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login." };
  const supabase = await createClient();
  for (const p of v.data) {
    const { error } = await supabase
      .from("schedule_procedures")
      .update({ duration_min: p.duration_min, price_cents: p.price === null ? null : Math.round(p.price * 100) })
      .eq("organization_id", org.id)
      .eq("name", p.name);
    if (error) return { ok: false, error: "Não foi possível salvar os procedimentos." };
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export interface NotificationRow { id: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }

export async function listNotifications(): Promise<{ unread: number; items: NotificationRow[] }> {
  if (!isSupabaseConfigured) return { unread: 0, items: [] };
  const org = await getCurrentOrg();
  if (!org) return { unread: 0, items: [] };
  const supabase = await createClient();
  const [items, unread] = await Promise.all([
    supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(15),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("organization_id", org.id).is("read_at", null),
  ]);
  return { unread: unread.count ?? 0, items: (items.data ?? []) as NotificationRow[] };
}

export async function markNotificationsRead(ids?: string[]): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const org = await getCurrentOrg();
  if (!org) return { ok: false };
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("organization_id", org.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids.slice(0, 50));
  const { error } = await q;
  return { ok: !error };
}

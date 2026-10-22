import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { normalizeBookingSettings, type BookingSettings } from "@/lib/booking/slots";

// Dados do agendamento online para o painel (RLS: membros da clínica).

export interface BookingOptions {
  professionals: { id: string; name: string }[];
  procedures: { name: string; duration_min: number }[];
}

export async function getBookingOptions(orgId: string): Promise<BookingOptions> {
  if (!isSupabaseConfigured || !orgId) return { professionals: [], procedures: [] };
  const supabase = await createClient();
  const [pros, procs] = await Promise.all([
    supabase.from("schedule_professionals").select("id, name").eq("organization_id", orgId).eq("active", true).order("created_at"),
    supabase.from("schedule_procedures").select("name, duration_min").eq("organization_id", orgId).order("name"),
  ]);
  return {
    professionals: (pros.data ?? []) as BookingOptions["professionals"],
    procedures: ((procs.data ?? []) as { name: string; duration_min?: number }[]).map((p) => ({ name: p.name, duration_min: p.duration_min ?? 60 })),
  };
}

export async function getBookingSettings(orgId: string): Promise<{ settings: BookingSettings; available: boolean }> {
  if (!isSupabaseConfigured || !orgId) return { settings: normalizeBookingSettings({}), available: false };
  const supabase = await createClient();
  const { data, error } = await supabase.from("schedule_booking_settings").select("settings").eq("organization_id", orgId).maybeSingle();
  return { settings: normalizeBookingSettings(data?.settings), available: !error };
}

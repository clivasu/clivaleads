import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export interface AdminOrgRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  flows: number;
  leads: number;
}

export interface AdminOverview {
  totals: { orgs: number; users: number; flows: number; leads: number };
  orgs: AdminOrgRow[];
}

// Visão geral de TODAS as contas (somente admin geral). Usa service-role
// (ignora RLS) — a página que chama já garante que é o super admin.
export async function getAdminOverview(): Promise<AdminOverview> {
  const empty: AdminOverview = { totals: { orgs: 0, users: 0, flows: 0, leads: 0 }, orgs: [] };
  if (!isSupabaseConfigured) return empty;

  const supabase = createAdminClient();
  const [{ data: orgs }, { data: flows }, { data: leads }, { count: users }] = await Promise.all([
    supabase.from("organizations").select("id,name,slug,created_at").order("created_at", { ascending: false }),
    supabase.from("flows").select("organization_id"),
    supabase.from("lead_sessions").select("organization_id"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const flowsBy = new Map<string, number>();
  for (const f of flows ?? []) flowsBy.set(f.organization_id, (flowsBy.get(f.organization_id) ?? 0) + 1);
  const leadsBy = new Map<string, number>();
  for (const l of leads ?? []) leadsBy.set(l.organization_id, (leadsBy.get(l.organization_id) ?? 0) + 1);

  const rows: AdminOrgRow[] = (orgs ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    created_at: o.created_at,
    flows: flowsBy.get(o.id) ?? 0,
    leads: leadsBy.get(o.id) ?? 0,
  }));

  return {
    totals: {
      orgs: rows.length,
      users: users ?? 0,
      flows: (flows ?? []).length,
      leads: (leads ?? []).length,
    },
    orgs: rows,
  };
}

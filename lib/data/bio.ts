import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { defaultBioConfig } from "@/lib/bio-templates";
import type { BioPage, BioConfig } from "@/lib/types";

// Bio da org logada (para o editor). Sem Supabase, retorna um rascunho demo.
export async function getMyBio(orgId: string): Promise<BioPage | null> {
  if (!isSupabaseConfigured) {
    return {
      id: "demo-bio", organization_id: orgId, title: "Meu link", template: "wellness",
      config: defaultBioConfig("wellness"), status: "draft", views: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
  }
  const supabase = await createClient();
  const { data } = await supabase.from("bio_pages").select("*").eq("organization_id", orgId).maybeSingle();
  return (data as BioPage) ?? null;
}

// Cliques por link (para o painel do editor).
export async function getBioClicks(bioId: string): Promise<{ total: number; byLabel: Record<string, number> }> {
  if (!isSupabaseConfigured || bioId === "demo-bio") return { total: 0, byLabel: {} };
  const supabase = await createClient();
  const { data } = await supabase.from("bio_clicks").select("label").eq("bio_page_id", bioId).limit(5000);
  const byLabel: Record<string, number> = {};
  for (const c of data ?? []) byLabel[c.label ?? "—"] = (byLabel[c.label ?? "—"] ?? 0) + 1;
  return { total: (data ?? []).length, byLabel };
}

// Bio PUBLICADA por identificador da conta (para servir em /<handle>).
export async function getPublicBioByHandle(handle: string): Promise<{ id: string; config: BioConfig } | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").eq("slug", handle).single();
  if (!org) return null;
  const { data: bio } = await supabase
    .from("bio_pages")
    .select("id, config, status")
    .eq("organization_id", org.id)
    .eq("status", "published")
    .maybeSingle();
  if (!bio) return null;
  return { id: bio.id as string, config: bio.config as BioConfig };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import { defaultBioConfig } from "@/lib/bio-templates";
import type { BioConfig, BioTemplateId } from "@/lib/types";

// Cria a bio da org (uma por conta) a partir de um template, se ainda não existir.
export async function ensureBio(template: BioTemplateId = "wellness"): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: true };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("bio_pages").select("id").eq("organization_id", org.id).maybeSingle();
  if (existing) return { ok: true };
  const { error } = await supabase.from("bio_pages").insert({
    organization_id: org.id,
    template,
    config: defaultBioConfig(template) as unknown as Record<string, unknown>,
    status: "draft",
    title: "Meu link",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bio");
  return { ok: true };
}

export interface SaveBioInput {
  template: BioTemplateId;
  config: BioConfig;
  status: "draft" | "published";
}

export async function saveBio(input: SaveBioInput): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: true };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bio_pages")
    .upsert(
      {
        organization_id: org.id,
        template: input.template,
        config: input.config as unknown as Record<string, unknown>,
        status: input.status,
        title: input.config.name,
      },
      { onConflict: "organization_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bio");
  revalidatePath(`/${org.slug}`);
  return { ok: true };
}

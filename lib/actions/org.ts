"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";

// Identificadores reservados (rotas do app) que não podem virar handle.
const RESERVED = new Set([
  "f", "api", "login", "dashboard", "flows", "leads", "analytics",
  "schedule", "settings", "admin", "new", "builder", "_next", "favicon.ico",
]);

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface UpdateOrgInput {
  name: string;
  handle: string;
  primaryColor: string;
  whatsapp: string;
  instagram: string;
  defaultMessage: string;
}

export async function updateOrg(input: UpdateOrgInput): Promise<{ ok: boolean; error?: string; handle?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Conecte o Supabase para salvar." };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Nenhuma organização encontrada. Faça login." };

  const handle = slugify(input.handle);
  if (!handle) return { ok: false, error: "Informe um identificador válido (ex.: marco)." };
  if (RESERVED.has(handle)) return { ok: false, error: `"${handle}" é reservado. Escolha outro.` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name,
      slug: handle,
      primary_color: input.primaryColor || null,
      whatsapp_number: input.whatsapp || null,
      instagram: input.instagram || null,
      default_message: input.defaultMessage || null,
    })
    .eq("id", org.id);

  if (error) {
    const dup = error.code === "23505" || /duplicate|unique/i.test(error.message);
    return { ok: false, error: dup ? `O identificador "${handle}" já está em uso.` : error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, handle };
}

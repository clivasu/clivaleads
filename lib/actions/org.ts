"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import { handleFormatError, officialHandleError, slugifyHandle } from "@/lib/handles";

export interface UpdateOrgInput {
  name: string;
  handle: string;
  primaryColor: string;
  whatsapp: string;
  instagram: string;
  defaultMessage: string;
  logoUrl?: string | null;
}

export async function updateOrg(input: UpdateOrgInput): Promise<{ ok: boolean; error?: string; handle?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Conecte o Supabase para salvar." };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Nenhuma organização encontrada. Faça login." };

  const handle = slugifyHandle(input.handle);
  const formatError = handleFormatError(handle);
  if (formatError) return { ok: false, error: formatError };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const officialError = officialHandleError(handle, user?.email);
  if (officialError) return { ok: false, error: officialError };
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name,
      slug: handle,
      primary_color: input.primaryColor || null,
      whatsapp_number: input.whatsapp || null,
      instagram: input.instagram || null,
      default_message: input.defaultMessage || null,
      ...(input.logoUrl !== undefined ? { logo_url: input.logoUrl || null } : {}),
    })
    .eq("id", org.id);

  if (error) {
    const dup = error.code === "23505" || /duplicate|unique/i.test(error.message);
    return { ok: false, error: dup ? `"${handle}" já está em uso por outra conta.` : error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/flows");
  return { ok: true, handle };
}

// O topo do menu mostra o nome da clínica. Quando a DONA da conta salva o
// próprio nome no perfil, a clínica passa a ter o mesmo nome.
export async function syncOrgNameFromOwner(name: string): Promise<{ ok: boolean }> {
  const clean = name.trim().slice(0, 120);
  if (!isSupabaseConfigured || !clean) return { ok: false };
  const org = await getCurrentOrg();
  if (!org) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { data: m } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (m?.role !== "owner") return { ok: false };
  const { error } = await supabase.from("organizations").update({ name: clean }).eq("id", org.id);
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}

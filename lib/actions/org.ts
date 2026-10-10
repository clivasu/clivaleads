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

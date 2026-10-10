"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import { handleFormatError, officialHandleError, slugifyHandle } from "@/lib/handles";

export interface HandleCheck {
  handle: string;
  available: boolean;
  error?: string;
}

// Diz se o identificador está livre. Usado no cadastro (sem login) e em
// Configurações (aí o identificador atual da própria conta conta como livre).
export async function checkHandle(raw: string): Promise<HandleCheck> {
  const handle = slugifyHandle(raw);
  const formatError = handleFormatError(handle);
  if (formatError) return { handle, available: false, error: formatError };
  if (!isSupabaseConfigured) return { handle, available: true };

  // "cliva" e "clivame": só a conta oficial.
  const { data: { user } } = await (await createClient()).auth.getUser();
  const officialError = officialHandleError(handle, user?.email);
  if (officialError) return { handle, available: false, error: officialError };

  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("id").eq("slug", handle).maybeSingle();
  if (!data) return { handle, available: true };

  const org = await getCurrentOrg().catch(() => null);
  if (org?.id === data.id) return { handle, available: true };
  return { handle, available: false, error: `"${handle}" já está em uso por outra conta.` };
}

// Logo após o cadastro: aplica o identificador escolhido na organização
// recém-criada. Se não der (ocupado ou sem sessão), fica o gerado pelo e-mail.
export async function claimHandle(raw: string): Promise<HandleCheck> {
  const check = await checkHandle(raw);
  if (!check.available || !isSupabaseConfigured) return check;
  const org = await getCurrentOrg();
  if (!org) return { ...check, available: false, error: "Sem sessão." };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ slug: check.handle }).eq("id", org.id);
  if (error) {
    const dup = error.code === "23505";
    return { ...check, available: false, error: dup ? `"${check.handle}" já está em uso por outra conta.` : error.message };
  }
  revalidatePath("/settings");
  return check;
}

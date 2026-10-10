import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { demoOrg } from "@/lib/demo-data";
import type { Organization } from "@/lib/types";

// Org "ativa" do usuário logado. Na V1, a primeira org da qual ele é membro.
// Sem Supabase conectado, retorna a Clínica Demo.
export async function getCurrentOrg(): Promise<Organization | null> {
  if (!isSupabaseConfigured) return demoOrg;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("organization_members")
    .select("organization:organizations(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return (data?.organization as unknown as Organization) ?? null;
}

export interface NavInfo {
  orgName: string;
  userName: string;
  userRole: string;
  isAdmin: boolean;
  avatarUrl?: string | null;
  orgLogo?: string | null;
}

// Dados para a sidebar (nome da clínica, usuário, se é admin geral).
export async function getNavInfo(): Promise<NavInfo> {
  if (!isSupabaseConfigured) {
    return { orgName: demoOrg.name, userName: "Modo demo", userRole: "Administradora", isAdmin: false };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgName: "", userName: "", userRole: "", isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_super_admin")
    .eq("id", user.id)
    .single();
  const org = await getCurrentOrg();
  // Nome do cadastro: metadata do signup > perfil > e-mail.
  const metaName = (user.user_metadata?.full_name as string | undefined)?.trim();
  return {
    orgName: org?.name ?? "Minha Clínica",
    userName: metaName || profile?.full_name || user.email || "",
    userRole: profile?.is_super_admin ? "Admin geral" : "Proprietário",
    isAdmin: Boolean(profile?.is_super_admin),
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) || null,
    orgLogo: org?.logo_url ?? null,
  };
}

// Verdadeiro se o usuário logado é admin geral (profiles.is_super_admin:
// mmarquessbsb@gmail.com e clivasuporte@gmail.com, ver migration 0009).
export async function isSuperAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  return Boolean(data?.is_super_admin);
}

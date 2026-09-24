import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentOrg } from "@/lib/data/org";
import { isSupabaseConfigured } from "@/lib/env";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const h = await headers();
  const host = h.get("host") ?? "prelead.vercel.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">Identidade, identificador público e white-label da clínica.</p>
      </header>

      {!isSupabaseConfigured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Conecte o Supabase para editar e salvar os dados da clínica.
        </p>
      ) : (
        <>
          <OrgSettingsForm org={org} baseUrl={baseUrl} />
          <ChangePasswordForm />
        </>
      )}
    </div>
  );
}

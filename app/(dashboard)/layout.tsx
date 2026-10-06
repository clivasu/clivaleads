import Link from "next/link";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";
import { getCurrentOrg, getNavInfo } from "@/lib/data/org";
import { getBillingState } from "@/lib/data/billing";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = await getNavInfo();

  // Cobrança: sem assinatura ativa (ou em teste), vai escolher um plano.
  // O admin geral nunca é bloqueado.
  let banner: { tone: "info" | "warn"; text: string } | null = null;
  if (isSupabaseConfigured && isStripeConfigured && !nav.isAdmin) {
    const org = await getCurrentOrg();
    if (org) {
      const billing = await getBillingState(org.id);
      if (billing.enabled && !billing.hasAccess) redirect("/assinar");
      const b = billing.billing;
      if (b?.status === "trialing" && b.trial_ends_at) {
        const days = Math.max(0, Math.ceil((new Date(b.trial_ends_at).getTime() - Date.now()) / 86400000));
        banner = { tone: "info", text: days > 0 ? `Teste grátis: faltam ${days} dia${days === 1 ? "" : "s"}.` : "Seu teste grátis termina hoje." };
      } else if (b?.status === "past_due") {
        banner = { tone: "warn", text: "Não conseguimos cobrar sua assinatura. Atualize o cartão para não perder o acesso." };
      }
    }
  }
  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50/60">
      <div className="pointer-events-none fixed -left-32 top-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-96 w-96 rounded-full bg-teal-200/20 blur-3xl" />
      <Sidebar orgName={nav.orgName} userName={nav.userName} userRole={nav.userRole} isAdmin={nav.isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {!isSupabaseConfigured && (
          <div className="border-b bg-amber-50 px-6 py-2 text-center text-xs text-amber-700">
            Modo demonstração — Supabase não conectado. Dados de exemplo.{" "}
            <Link href="/settings" className="font-semibold underline">
              Como conectar
            </Link>
          </div>
        )}
        {banner && (
          <div className={banner.tone === "warn" ? "border-b bg-amber-50 px-6 py-2 text-center text-xs text-amber-800" : "border-b bg-emerald-50 px-6 py-2 text-center text-xs text-emerald-800"}>
            {banner.text}{" "}
            <Link href="/settings#plano" className="font-semibold underline">
              {banner.tone === "warn" ? "Atualizar pagamento" : "Ver plano"}
            </Link>
          </div>
        )}
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

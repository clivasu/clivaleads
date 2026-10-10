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
    <div className="relative flex min-h-screen bg-[#f3f5f7]">
      <Sidebar orgName={nav.orgName} userName={nav.userName} userRole={nav.userRole} isAdmin={nav.isAdmin} avatarUrl={nav.avatarUrl} orgLogo={nav.orgLogo} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {!isSupabaseConfigured && (
          <div className="mx-3 mb-3 rounded-xl bg-amber-50 px-4 py-2 text-center text-xs text-amber-700 md:ml-0 md:mr-4">
            Modo demonstração — Supabase não conectado. Dados de exemplo.{" "}
            <Link href="/settings" className="font-semibold underline">
              Como conectar
            </Link>
          </div>
        )}
        {banner && (
          <div className={banner.tone === "warn" ? "mx-3 mb-3 rounded-xl bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 md:ml-0 md:mr-4" : "mx-3 mb-3 rounded-xl bg-emerald-50 px-4 py-2 text-center text-xs text-emerald-800 md:ml-0 md:mr-4"}>
            {banner.text}{" "}
            <Link href="/settings#plano" className="font-semibold underline">
              {banner.tone === "warn" ? "Atualizar pagamento" : "Ver plano"}
            </Link>
          </div>
        )}
        {/* Conteúdo num painel branco de cantos arredondados sobre o fundo neutro. */}
        <main className="flex flex-1 flex-col px-3 pb-3 md:pl-0 md:pr-4 md:pb-4">
          <div className="flex-1 overflow-hidden rounded-[28px] border border-slate-200/70 bg-white px-6 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:px-8 md:py-7">
            <div className="mx-auto max-w-7xl">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { getBillingState } from "@/lib/data/billing";
import { isStripeConfigured } from "@/lib/stripe";
import { ClivaLogo } from "@/components/brand/logo";
import { PlanPicker } from "@/components/billing/plan-picker";

export const dynamic = "force-dynamic";

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const { plano } = await searchParams;
  if (!isStripeConfigured) redirect("/dashboard");

  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const state = await getBillingState(org.id);
  if (!state.enabled || state.hasAccess) redirect("/dashboard");

  const status = state.billing?.status;

  // Conta bloqueada pelo admin: não oferece planos (assinar não desbloqueia).
  if (status === "blocked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f5f7] px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="flex justify-center"><ClivaLogo /></div>
          <h1 className="mt-6 text-xl font-bold text-slate-900">Conta suspensa</h1>
          <p className="mt-2 text-sm text-slate-500">
            O acesso a esta conta foi suspenso. Para entender o motivo ou reativar, fale com o suporte da Cliva.
          </p>
          <a href="mailto:clivasuporte@gmail.com" className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Falar com o suporte
          </a>
        </div>
      </div>
    );
  }
  const notice =
    status === "canceled" ? "Sua assinatura foi cancelada. Escolha um plano para voltar a usar a Cliva."
    : status === "unpaid" || status === "incomplete_expired" ? "Não conseguimos confirmar o pagamento. Escolha um plano para reativar."
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50/60 px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-center"><ClivaLogo /></div>
        <PlanPicker initialPlan={plano} trialAvailable={!state.billing?.trial_used} notice={notice} />
      </div>
    </div>
  );
}

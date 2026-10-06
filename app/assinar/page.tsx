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

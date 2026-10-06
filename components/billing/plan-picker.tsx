"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ArrowRight, Loader2, ShieldCheck, Ticket } from "lucide-react";
import { PLANS, TRIAL_DAYS, formatPrice, getPlan, planLimits, type PlanKey } from "@/lib/plans";
import { startCheckout } from "@/lib/actions/billing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function PlanPicker({
  initialPlan, trialAvailable, notice,
}: {
  initialPlan?: string;
  trialAvailable: boolean;
  notice?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanKey>(getPlan(initialPlan)?.key ?? "pro");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subscribe() {
    setError(null);
    start(async () => {
      const res = await startCheckout(selected);
      if (res.ok && res.url) window.location.href = res.url;
      else setError(res.error ?? "Não foi possível abrir o pagamento.");
    });
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  const plan = getPlan(selected)!;

  return (
    <div className="mt-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Escolha o plano da sua clínica</h1>
        <p className="mt-2 text-slate-500">
          {trialAvailable
            ? `${TRIAL_DAYS} dias grátis. A cobrança só começa depois do teste, e você cancela quando quiser.`
            : "Escolha um plano para continuar usando a Cliva."}
        </p>
        {notice && <p className="mx-auto mt-4 max-w-xl rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{notice}</p>}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const on = p.key === selected;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelected(p.key)}
              className={cn(
                "relative flex flex-col rounded-3xl border-2 bg-white p-6 text-left transition-all",
                on ? "border-emerald-500 shadow-xl shadow-emerald-900/10" : "border-slate-200 hover:border-emerald-200",
              )}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white">MAIS ESCOLHIDO</span>
              )}
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold text-slate-900">{p.name}</p>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border-2", on ? "border-emerald-500 bg-emerald-500" : "border-slate-300")}>
                  {on && <Check className="h-3 w-3 text-white" />}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{p.desc}</p>
              <p className="mt-4 flex items-end gap-1">
                <span className="pb-1 text-sm font-semibold text-slate-400">R$</span>
                <span className="font-display text-4xl font-semibold tracking-tight text-slate-900">{formatPrice(p.priceCents)}</span>
                <span className="pb-1 text-xs text-slate-500">/mês</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {planLimits(p).map(([l, ok]) => (
                  <li key={l} className={cn("flex items-center gap-2", !ok && "text-slate-400")}>
                    {ok ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4" />} {l}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-8 max-w-md text-center">
        <button
          onClick={subscribe}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {trialAvailable ? `Começar ${TRIAL_DAYS} dias grátis no ${plan.name}` : `Assinar o ${plan.name}`}
          {!pending && <ArrowRight className="h-5 w-5" />}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Pagamento seguro pela Stripe.
          {trialAvailable && ` Depois do teste: R$ ${formatPrice(plan.priceCents)}/mês.`}
        </p>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Ticket className="h-3.5 w-3.5 text-emerald-600" /> Tem um cupom? Você aplica na próxima tela.
        </p>
        <button onClick={signOut} className="mt-6 text-xs text-slate-400 underline hover:text-slate-600">Sair da conta</button>
      </div>
    </div>
  );
}

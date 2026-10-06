"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CreditCard, Loader2 } from "lucide-react";
import { openBillingPortal } from "@/lib/actions/billing";
import { formatLeads, formatPrice, type Plan } from "@/lib/plans";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Teste grátis",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  unpaid: "Não paga",
  incomplete: "Aguardando pagamento",
  legacy: "Cortesia",
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : null;

export function BillingCard({
  plan, status, trialEndsAt, periodEnd, cancelAtPeriodEnd, hasCustomer, usage,
}: {
  plan: Plan | null;
  status: string | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  usage: { publishedFlows: number; leadsThisMonth: number };
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const portal = () =>
    start(async () => {
      setError(null);
      const res = await openBillingPortal();
      if (res.ok && res.url) window.location.href = res.url;
      else setError(res.error ?? "Não foi possível abrir o portal.");
    });

  const bar = (used: number, max: number) => (
    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
      <div className={used >= max ? "h-1.5 rounded-full bg-rose-500" : "h-1.5 rounded-full bg-emerald-500"} style={{ width: `${Math.min(100, (used / max) * 100)}%` }} />
    </div>
  );

  return (
    <section id="plano" className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><CreditCard className="h-4 w-4 text-emerald-600" /> Plano e cobrança</h2>
          <p className="mt-1 text-sm text-slate-500">
            {plan ? <>Cliva <b className="text-slate-800">{plan.name}</b> · R$ {formatPrice(plan.priceCents)}/mês</> : "Nenhum plano ativo"}
          </p>
        </div>
        {status && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{STATUS_LABEL[status] ?? status}</span>}
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        {status === "trialing" && fmtDate(trialEndsAt) && <p>O teste grátis vai até {fmtDate(trialEndsAt)}. A primeira cobrança acontece nesse dia.</p>}
        {status !== "trialing" && periodEnd && !cancelAtPeriodEnd && <p>Próxima cobrança em {fmtDate(periodEnd)}.</p>}
        {cancelAtPeriodEnd && periodEnd && <p className="text-amber-700">Assinatura cancelada. O acesso continua até {fmtDate(periodEnd)}.</p>}
      </div>

      {plan && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="flex justify-between text-xs text-slate-500"><span>Funis publicados</span><span>{usage.publishedFlows} de {plan.funnels}</span></p>
            {bar(usage.publishedFlows, plan.funnels)}
          </div>
          <div>
            <p className="flex justify-between text-xs text-slate-500"><span>Leads este mês</span><span>{usage.leadsThisMonth.toLocaleString("pt-BR")} de {formatLeads(plan.leadsPerMonth)}</span></p>
            {bar(usage.leadsThisMonth, plan.leadsPerMonth)}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {hasCustomer ? (
          <button onClick={portal} disabled={pending} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Trocar plano, cartão ou cancelar
          </button>
        ) : status !== "legacy" ? (
          <Link href="/assinar" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Escolher plano</Link>
        ) : null}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

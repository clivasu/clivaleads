"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight, ArrowUpRight, Ban, CheckCircle2, CircleDollarSign, Gift, Loader2, RefreshCw, Search,
  Settings2, ShieldCheck, Trash2, TrendingUp, Users, Wallet, X,
} from "lucide-react";
import type { AdminDashboard, AccountRow, CostRow } from "@/lib/data/admin-metrics";
import { PLANS, getPlan, type PlanKey } from "@/lib/plans";
import { addCost, blockAccount, changePlan, deleteCost, endCost, grantAccess, returnToStripe } from "@/lib/actions/admin";
import { C, CumulativeChart, MovementChart, MrrAreaChart, ResultChart, RevenueCostChart, SignupsChart, Sparkline, money, moneyShort } from "@/components/admin/charts";
import { cn } from "@/lib/utils";

type Tab = "overview" | "finance" | "accounts";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

function Delta({ now, prev, upIsGood = true, asMoney = false, compact = false }: { now: number; prev: number; upIsGood?: boolean; asMoney?: boolean; compact?: boolean }) {
  if (!prev && !now) return <span className="text-xs text-slate-400">sem variação</span>;
  const diff = now - prev;
  const up = diff >= 0;
  const good = up === upIsGood;
  const rel = prev ? Math.abs(diff / prev) : null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", good ? "text-emerald-700" : "text-rose-600")}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {rel !== null ? pct(rel) : asMoney ? moneyShort(Math.abs(diff)) : Math.abs(diff)}
      {!compact && <span className="ml-1 font-normal text-slate-400">vs mês anterior</span>}
    </span>
  );
}

function Card({ title, sub, children, className, right }: { title: string; sub?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200/80 bg-white p-5", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, foot, icon: Icon }: { label: string; value: string; foot?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">{Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {foot && <div className="mt-1 text-xs text-slate-500">{foot}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: "Pagando", dot: "bg-emerald-500", text: "text-emerald-700" },
  trialing: { label: "Em teste", dot: "bg-sky-500", text: "text-sky-700" },
  comp: { label: "Cortesia", dot: "bg-violet-500", text: "text-violet-700" },
  legacy: { label: "Cortesia (antiga)", dot: "bg-violet-400", text: "text-violet-700" },
  past_due: { label: "Pagamento pendente", dot: "bg-amber-500", text: "text-amber-700" },
  blocked: { label: "Bloqueada", dot: "bg-rose-500", text: "text-rose-700" },
  canceled: { label: "Cancelada", dot: "bg-slate-400", text: "text-slate-600" },
  none: { label: "Sem plano", dot: "bg-slate-300", text: "text-slate-500" },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, dot: "bg-slate-300", text: "text-slate-600" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", s.text)}>
      <span className={cn("h-2 w-2 rounded-full", s.dot)} />{s.label}
    </span>
  );
}

export function AdminDashboardView({ data, demo }: { data: AdminDashboard; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, startRefresh] = useTransition();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <ShieldCheck className="h-6 w-6 text-emerald-600" /> Admin geral
          </h1>
          <p className="text-sm text-slate-500">MRR, assinantes, investimento e todas as contas da Cliva.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-slate-100 p-1 text-sm font-medium">
            {([["overview", "Visão geral"], ["finance", "Investimento x receita"], ["accounts", "Contas"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={cn("rounded-full px-4 py-1.5 transition-colors", tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{l}</button>
            ))}
          </div>
          <button onClick={() => startRefresh(() => router.refresh())} title="Atualizar" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>
      </header>

      {demo && <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-800">Dados de exemplo (modo demonstração, sem banco conectado).</p>}
      {!data.stripeOk && !demo && (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Não deu para ler a Stripe agora ({data.stripeError}). MRR e assinantes vêm da tabela de contas; receita e taxas ficam zeradas.
        </p>
      )}

      {tab === "overview" && <Overview d={data} />}
      {tab === "finance" && <Finance d={data} demo={demo} />}
      {tab === "accounts" && <Accounts d={data} demo={demo} />}
    </div>
  );
}

/* =============================== visão geral =============================== */
function Overview({ d }: { d: AdminDashboard }) {
  const k = d.kpis;
  const mrrValues = d.mrrSeries.map((m) => m.mrr);
  const maxPlan = Math.max(1, ...d.planMix.map((p) => p.pagantes + p.teste + p.cortesia));
  const maxStatus = Math.max(1, ...d.statusMix.map((s) => s.count));
  return (
    <div className="space-y-5">
      {/* números principais */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 lg:col-span-1">
          <p className="text-sm font-medium text-slate-500">MRR (receita recorrente mensal)</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight text-slate-900">{money(k.mrr)}</p>
          <div className="mt-2"><Delta now={k.mrr} prev={k.mrrPrevMonth} asMoney /></div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-xs text-slate-500">ARR: <b className="text-slate-800">{money(k.arr)}</b></p>
            <Sparkline values={mrrValues} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-4">
          <Tile icon={Users} label="Assinantes pagantes" value={String(k.payers)} foot={<>ticket médio {money(k.arpu)}</>} />
          <Tile icon={CircleDollarSign} label="Receita do mês" value={moneyShort(k.revenueMonth)} foot={<Delta now={k.revenueMonth} prev={k.revenuePrevMonth} asMoney compact />} />
          <Tile icon={TrendingUp} label="Novos pagantes (30d)" value={`+${k.newPaying30}`} foot={<>{k.churned30} cancelamento{k.churned30 === 1 ? "" : "s"}</>} />
          <Tile label="Churn (30d)" value={pct(k.churnRate30)} foot="cancelaram ÷ pagantes há 30 dias" />
          <Tile label="Em teste grátis" value={String(k.trialing)} foot={<>{money(k.trialMrr)}/mês se todos assinarem</>} />
          <Tile label="Conversão do teste" value={pct(k.conversionRate)} foot="testes que viraram pagantes" />
          <Tile icon={Gift} label="Cortesias" value={String(k.comp)} foot={<>{money(k.compValue)}/mês liberados</>} />
          <Tile label="Cadastros (30d)" value={String(k.signups30)} foot={<Delta now={k.signups30} prev={k.signupsPrev30} compact />} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Evolução do MRR" sub="Últimos 12 meses, valor bruto antes de cupons" className="lg:col-span-2">
          <MrrAreaChart data={d.mrrSeries} />
        </Card>
        <Card title="Novos pagantes x cancelamentos" sub="Por mês · acima do zero entram, abaixo saem"
          right={<Legend items={[["Novos", C.main], ["Cancelamentos", C.loss]]} />}>
          <MovementChart data={d.movement} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Cadastros por dia" sub="Últimos 30 dias" className="lg:col-span-2">
          <SignupsChart data={d.signupsDaily} />
        </Card>
        <Card title="Contas por situação" sub={`${d.kpis.accounts} contas no total`}>
          <ul className="space-y-2.5">
            {d.statusMix.map((s) => (
              <li key={s.status}>
                <div className="mb-1 flex items-center justify-between text-xs"><StatusBadge status={s.status} /><span className="font-semibold text-slate-800">{s.count}</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(s.count / maxStatus) * 100}%`, background: C.main }} /></div>
              </li>
            ))}
            {d.statusMix.length === 0 && <li className="text-sm text-slate-400">Nenhuma conta ainda.</li>}
          </ul>
        </Card>
      </div>

      <Card title="Assinantes por plano" sub="Pagantes, em teste e cortesias em cada plano"
        right={<Legend items={[["Pagantes", C.main], ["Em teste", C.compare], ["Cortesia", C.third]]} />}>
        <div className="space-y-3">
          {d.planMix.map((p) => {
            const plan = PLANS.find((x) => x.name === p.plan);
            const total = p.pagantes + p.teste + p.cortesia;
            return (
              <div key={p.plan} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-sm">
                <span className="font-medium text-slate-800">{p.plan} <span className="text-xs font-normal text-slate-400">{plan ? money(plan.priceCents) : ""}</span></span>
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" style={{ gap: total ? 2 : 0 }}>
                  {[[p.pagantes, C.main], [p.teste, C.compare], [p.cortesia, C.third]].map(([v, color], i) =>
                    Number(v) > 0 ? <div key={i} style={{ width: `${(Number(v) / maxPlan) * 100}%`, background: String(color) }} /> : null)}
                </div>
                <span className="whitespace-nowrap text-xs text-slate-500">{p.pagantes} pag. · {p.teste} teste · {p.cortesia} cort.</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 text-xs text-slate-500">
      {items.map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}
    </div>
  );
}

/* ============================ investimento x receita ============================ */
function Finance({ d, demo }: { d: AdminDashboard; demo?: boolean }) {
  const f = d.finance;
  const receita12 = f.reduce((s, x) => s + x.receita, 0);
  const custos12 = f.reduce((s, x) => s + x.custos + x.taxas, 0);
  const resultado12 = receita12 - custos12;
  const acumulado = f[f.length - 1]?.acumulado ?? 0;
  const cur = f[f.length - 1];
  const payers = d.kpis.payers;
  const need = d.breakEvenCustomers;
  const progress = need ? Math.min(1, payers / need) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={Wallet} label="Receita (12 meses)" value={moneyShort(receita12)} foot="faturas pagas na Stripe" />
        <Tile label="Custos + taxas (12 meses)" value={moneyShort(custos12)} foot="seus custos cadastrados + taxas da Stripe" />
        <Tile label="Resultado (12 meses)" value={`${resultado12 >= 0 ? "+" : "−"}${moneyShort(Math.abs(resultado12))}`}
          foot={<span className={resultado12 >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-600"}>{resultado12 >= 0 ? "Lucro" : "Prejuízo"} no período</span>} />
        <Tile label="Resultado deste mês" value={cur ? `${cur.resultado >= 0 ? "+" : "−"}${moneyShort(Math.abs(cur.resultado))}` : "—"}
          foot={cur ? <>receita {moneyShort(cur.receita)} · saídas {moneyShort(cur.custos + cur.taxas)}</> : null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">Para empatar os custos fixos</p>
          {need !== null ? (
            <>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-slate-900">{need}</p>
              <p className="text-sm text-slate-500">clientes pagantes · hoje você tem <b className="text-slate-800">{payers}</b></p>
              <div className="mt-4 h-2.5 rounded-full bg-emerald-100"><div className="h-2.5 rounded-full bg-emerald-600 transition-all" style={{ width: `${progress * 100}%` }} /></div>
              <p className="mt-2 text-xs text-slate-500">
                Custos fixos de {money(d.costsThisMonth)}/mês ÷ ticket {d.ticketIsEstimate ? "estimado" : "médio"} de {money(d.ticketRef)}.
                {progress >= 1 ? " Os custos fixos já estão cobertos." : ` Faltam ${Math.max(0, need - payers)}.`}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Cadastre seus custos mensais abaixo para ver quantos clientes cobrem a operação.</p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-xs">
            <div><p className="text-slate-500">CAC (3 meses)</p><p className="text-base font-semibold text-slate-900">{d.cac !== null ? money(d.cac) : "—"}</p><p className="text-slate-400">marketing ÷ novos pagantes</p></div>
            <div><p className="text-slate-500">Retorno do CAC</p><p className="text-base font-semibold text-slate-900">{d.paybackMonths !== null ? `${d.paybackMonths.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses` : "—"}</p><p className="text-slate-400">CAC ÷ ticket médio</p></div>
          </div>
        </div>
        <Card title="Receita x saídas por mês" sub="Saídas = custos cadastrados + taxas da Stripe" className="lg:col-span-2"
          right={<Legend items={[["Receita", C.main], ["Saídas", C.compare]]} />}>
          <RevenueCostChart data={f} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Lucro ou prejuízo por mês" sub="Acima do zero: lucro · abaixo: prejuízo">
          <ResultChart data={f} />
        </Card>
        <Card title="Resultado acumulado" sub={`Hoje: ${acumulado >= 0 ? "+" : "−"}${money(Math.abs(acumulado))} desde ${f[0]?.label ?? ""}`}>
          <CumulativeChart data={f} />
        </Card>
      </div>

      <CostsManager costs={d.costs} costsOk={d.costsOk} demo={demo} />
    </div>
  );
}

const CATEGORIES: [string, string][] = [["infra", "Infraestrutura"], ["marketing", "Marketing / anúncios"], ["ferramentas", "Ferramentas"], ["pessoas", "Pessoas / serviços"], ["outros", "Outros"]];
const catLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;

function CostsManager({ costs, costsOk, demo }: { costs: CostRow[]; costsOk: boolean; demo?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ description: "", category: "infra", amount: "", kind: "monthly" as "monthly" | "once", startsOn: today });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addCost({ ...form, amount: Number(form.amount.replace(",", ".")) });
      if (!res.ok) { setError(res.error ?? "Falha ao salvar."); return; }
      setForm({ ...form, description: "", amount: "" });
      router.refresh();
    });
  };
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const res = await fn();
    if (!res.ok) setError(res.error ?? "Falha.");
    else router.refresh();
  });

  const input = "rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";
  const isActive = (c: CostRow) => c.kind === "monthly" && (!c.ends_on || c.ends_on >= today);

  return (
    <Card title="Seus investimentos e custos" sub="Supabase, Vercel, domínio, anúncios, ferramentas... Mensais contam todo mês até você encerrar.">
      {!costsOk && !demo ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Para cadastrar custos, rode o SQL <b>supabase/migrations/0008_admin_billing.sql</b> no Supabase (SQL Editor).
        </p>
      ) : (
        <>
          <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1.6fr_1fr_0.8fr_0.9fr_1fr_auto]">
            <input className={input} placeholder="Ex.: Supabase Pro" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className={input} inputMode="decimal" placeholder="R$ 0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "monthly" | "once" })}>
              <option value="monthly">Mensal</option><option value="once">Único</option>
            </select>
            <input className={input} type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} title={form.kind === "monthly" ? "Começou em" : "Data"} />
            <button disabled={pending || demo} className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-slate-400"><th className="py-2 font-medium">Descrição</th><th className="font-medium">Categoria</th><th className="font-medium">Tipo</th><th className="font-medium">Desde</th><th className="text-right font-medium">Valor</th><th /></tr></thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2.5 font-medium text-slate-800">{c.description}</td>
                    <td className="text-slate-500">{catLabel(c.category)}</td>
                    <td className="text-slate-500">{c.kind === "once" ? "Único" : isActive(c) ? "Mensal" : `Mensal (até ${new Date(`${c.ends_on}T12:00:00`).toLocaleDateString("pt-BR")})`}</td>
                    <td className="text-slate-500">{new Date(`${c.starts_on}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                    <td className="text-right font-semibold tabular-nums text-slate-900">{money(c.amount_cents)}{c.kind === "monthly" ? <span className="font-normal text-slate-400">/mês</span> : ""}</td>
                    <td className="w-24 text-right">
                      {isActive(c) && <button disabled={demo} onClick={() => act(() => endCost(c.id))} className="mr-2 text-xs text-slate-500 underline hover:text-slate-800" title="Parar de contar a partir de hoje">Encerrar</button>}
                      <button disabled={demo} onClick={() => confirm(`Apagar "${c.description}"?`) && act(() => deleteCost(c.id))} className="text-slate-400 hover:text-rose-600" aria-label="Apagar"><Trash2 className="inline h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
                {costs.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">Nenhum custo cadastrado ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

/* ================================== contas ================================== */
const FILTERS: [string, string][] = [["all", "Todas"], ["active", "Pagando"], ["trialing", "Em teste"], ["comp", "Cortesia"], ["past_due", "Pendentes"], ["blocked", "Bloqueadas"], ["none", "Sem plano"]];

function Accounts({ d, demo }: { d: AdminDashboard; demo?: boolean }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const rows = useMemo(() => d.accountsList.filter((a) => {
    const okFilter = filter === "all" || a.status === filter || (filter === "comp" && a.status === "legacy") || (filter === "none" && (a.status === "none" || a.status === "canceled"));
    const t = q.trim().toLowerCase();
    const okQ = !t || [a.name, a.slug, a.email ?? ""].some((x) => x.toLowerCase().includes(t));
    return okFilter && okQ;
  }), [d.accountsList, q, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, link ou e-mail" className="w-full rounded-full border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-400 focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === k ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50")}>{l}</button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50/70 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">Conta</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 text-right font-medium">Paga/mês</th>
              <th className="px-4 py-3 text-right font-medium">Funis</th>
              <th className="px-4 py-3 text-right font-medium">Leads</th>
              <th className="px-4 py-3 font-medium">Criada em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.email ?? "sem e-mail"} · <a href={`/${a.slug}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">/{a.slug}</a></p>
                </td>
                <td className="px-4 py-3 text-slate-700">{getPlan(a.plan)?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                  {a.manual && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title="Definido por você no admin">manual</span>}
                  {a.cancelAtPeriodEnd && <p className="text-[11px] text-amber-700">cancela no fim do período</p>}
                  {a.admin_note && <p className="max-w-[220px] truncate text-[11px] text-slate-400" title={a.admin_note}>{a.admin_note}</p>}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-800">{a.mrrCents ? money(a.mrrCents) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{a.flows}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{a.leads}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(a.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(a)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <Settings2 className="h-3.5 w-3.5" /> Gerenciar
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Nenhuma conta encontrada.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <ManageDialog account={editing} demo={demo} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ManageDialog({ account: a, onClose, demo }: { account: AccountRow; onClose: () => void; demo?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanKey>(a.plan ?? "pro");
  const [note, setNote] = useState(a.admin_note ?? "");
  const [stopBilling, setStopBilling] = useState(true);
  const blocked = a.status === "blocked";
  const paysStripe = a.hasStripeSub && !a.manual && ["active", "trialing", "past_due"].includes(a.status);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error ?? "Falha."); return; }
      onClose();
      router.refresh();
    });
  };

  const btn = "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !pending && onClose()}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{a.name}</h3>
            <p className="text-xs text-slate-500">{a.email ?? "sem e-mail"} · /{a.slug}</p>
            <div className="mt-1.5"><StatusBadge status={a.status} /></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block text-xs font-medium text-slate-500">Plano
            <select value={plan} onChange={(e) => setPlan(e.target.value as PlanKey)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none">
              {PLANS.map((p) => <option key={p.key} value={p.key}>{p.name} · {money(p.priceCents)}/mês · {p.funnels} funi{p.funnels === 1 ? "l" : "s"}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">Anotação (só você vê)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: amigo, liberado até dezembro" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none" />
          </label>
        </div>

        <div className="mt-5 space-y-2">
          {!paysStripe && (
            <button disabled={pending || demo} onClick={() => run(() => grantAccess(a.id, plan, note))} className={cn(btn, "bg-emerald-600 text-white hover:bg-emerald-700")}>
              <Gift className="h-4 w-4" />
              {blocked ? `Desbloquear como cortesia no ${getPlan(plan)?.name}`
                : a.status === "comp" || a.status === "legacy" ? `Salvar cortesia no ${getPlan(plan)?.name}`
                : `Liberar como cortesia no ${getPlan(plan)?.name}`}
            </button>
          )}
          {paysStripe && plan !== a.plan && (
            <button disabled={pending || demo} onClick={() => run(() => changePlan(a.id, plan), paysStripe ? `Trocar a assinatura na Stripe para o ${getPlan(plan)?.name}? A diferença é cobrada ou creditada proporcionalmente.` : undefined)}
              className={cn(btn, "border border-slate-200 text-slate-800 hover:bg-slate-50")}>
              <CheckCircle2 className="h-4 w-4" /> Trocar para o {getPlan(plan)?.name}{paysStripe ? " (na Stripe)" : ""}
            </button>
          )}
          {a.manual && a.hasStripeSub && (
            <button disabled={pending || demo} onClick={() => run(() => returnToStripe(a.id), "Voltar a seguir a assinatura da Stripe? Plano e situação passam a vir de lá.")}
              className={cn(btn, "border border-slate-200 text-slate-800 hover:bg-slate-50")}>
              <RefreshCw className="h-4 w-4" /> Voltar a seguir a Stripe
            </button>
          )}
          {a.manual && !a.hasStripeSub && !blocked && (
            <button disabled={pending || demo} onClick={() => run(() => returnToStripe(a.id), "Tirar a cortesia? A conta vai precisar escolher um plano e pagar para continuar.")}
              className={cn(btn, "border border-slate-200 text-slate-800 hover:bg-slate-50")}>
              Tirar cortesia (passa a precisar assinar)
            </button>
          )}
          {!blocked && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
              {a.hasStripeSub && (
                <label className="mb-2 flex items-start gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={stopBilling} onChange={(e) => setStopBilling(e.target.checked)} className="mt-0.5 accent-rose-600" />
                  Também parar a cobrança na Stripe (cancela no fim do período já pago, sem estorno)
                </label>
              )}
              <button disabled={pending || demo} onClick={() => run(() => blockAccount(a.id, stopBilling, note), `Bloquear "${a.name}"? A pessoa perde o acesso ao painel e os funis param de gravar leads.`)}
                className={cn(btn, "bg-rose-600 text-white hover:bg-rose-700")}>
                <Ban className="h-4 w-4" /> Bloquear acesso
              </button>
            </div>
          )}
        </div>

        {pending && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando…</p>}
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {demo && <p className="mt-3 text-xs text-amber-700">No modo demonstração as ações ficam desativadas.</p>}
      </div>
    </div>
  );
}

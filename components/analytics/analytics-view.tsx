"use client";

import { useState } from "react";
import {
  ArrowRight, TrendingUp, MoreHorizontal, Search, SlidersHorizontal,
  RotateCcw, ChevronDown, DollarSign, Users, MessageCircle, Wallet,
} from "lucide-react";
import type { AnalyticsData } from "@/lib/data/analytics";

const STATUS_STYLE: Record<string, string> = {
  Convertido: "bg-emerald-50 text-emerald-700",
  WhatsApp: "bg-teal-50 text-teal-700",
  Qualificado: "bg-sky-50 text-sky-700",
  Agendado: "bg-indigo-50 text-indigo-700",
  Novo: "bg-slate-100 text-slate-600",
  Perdido: "bg-rose-50 text-rose-700",
};

const CARD = "rounded-2xl border border-slate-200 bg-white shadow-sm";

function fmtTrend(n: number) {
  return `${n >= 0 ? "+" : ""}${n}%`;
}

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const [range, setRange] = useState<"monthly" | "yearly">("monthly");
  const [hover, setHover] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const flow = range === "monthly" ? data.monthly : data.yearly;
  const peak = flow.reduce((mi, d, i, arr) => (d.leads > arr[mi].leads ? i : mi), 0);
  const active = hover ?? peak;
  const max = Math.max(1, ...flow.map((d) => d.leads));
  const total = flow.reduce((s, d) => s + d.leads, 0);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round((max * f) / 10) * 10);

  const summary = [
    { key: "revenue", title: "Receita do mês", sub: "Faturamento estimado", value: `R$ ${data.revenueEstimate.toLocaleString("pt-BR")}`, trend: fmtTrend(data.leadsTrend), icon: DollarSign, link: "Ver detalhes", featured: true },
    { key: "leads", title: "Leads captados", sub: "Total no período", value: data.totalLeads.toLocaleString("pt-BR"), trend: fmtTrend(data.leadsTrend), icon: Users, link: "Ver resumo", featured: false },
    { key: "conv", title: "Conversão WhatsApp", sub: "Contatos → WhatsApp", value: `${(data.whatsappRate * 100).toFixed(1).replace(".", ",")}%`, trend: fmtTrend(data.whatsappTrend), icon: MessageCircle, link: "Analisar", featured: false },
  ];

  const recent = data.recent.filter((a) =>
    !query || a.who.toLowerCase().includes(query.toLowerCase()) || a.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">Resumo geral de desempenho dos funis.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
            Este mês <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
            <RotateCcw className="h-4 w-4 text-slate-400" /> Atualizar
          </button>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {summary.map((c) => {
          const Icon = c.icon;
          const f = c.featured;
          return (
            <div key={c.key} className={f ? "relative overflow-hidden rounded-2xl bg-emerald-500 p-5 text-white shadow-sm shadow-emerald-500/20" : `${CARD} p-5`}>
              {f && <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />}
              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${f ? "bg-white/20" : "bg-emerald-50"}`}>
                    <Icon className={`h-5 w-5 ${f ? "text-white" : "text-emerald-600"}`} />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${f ? "text-white" : "text-slate-800"}`}>{c.title}</p>
                    <p className={`text-xs ${f ? "text-white/70" : "text-slate-400"}`}>{c.sub}</p>
                  </div>
                </div>
                <MoreHorizontal className={`h-5 w-5 ${f ? "text-white/70" : "text-slate-300"}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-3xl font-bold tracking-tight ${f ? "text-white" : "text-slate-900"}`}>{c.value}</span>
                <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${f ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"}`}>
                  <TrendingUp className="h-3 w-3" /> {c.trend}
                </span>
              </div>
              <button className={`mt-5 flex w-full items-center justify-between border-t pt-3 text-sm font-medium ${f ? "border-white/20 text-white/90" : "border-slate-100 text-slate-500 hover:text-emerald-600"}`}>
                {c.link} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* wallet + chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* por procedimento */}
        <div className={`${CARD} p-5 lg:col-span-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50"><Wallet className="h-4 w-4 text-emerald-600" /></span>
              <span className="font-semibold text-slate-800">Por procedimento</span>
            </div>
            <button className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">Ver todos</button>
          </div>
          {data.byProcedure.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sem leads por procedimento ainda.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {data.byProcedure.map((p) => (
                <div key={p.name} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-colors hover:bg-slate-50">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="h-6 w-6 rounded-full" style={{ background: p.color }} />
                    <MoreHorizontal className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="truncate text-sm text-slate-500">{p.name}</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{p.leads} <span className="text-xs font-normal text-slate-400">leads</span></p>
                  <p className="mt-1 text-[11px] text-slate-400">{p.conv}% de conversão</p>
                  <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${p.active ? "text-emerald-600" : "text-slate-400"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${p.active ? "bg-emerald-500" : "bg-slate-300"}`} />
                    {p.active ? "Ativo" : "Inativo"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* fluxo de leads */}
        <div className={`${CARD} p-5 lg:col-span-7`}>
          <div className="mb-2 flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Fluxo de Leads</p>
              <p className="text-3xl font-bold tracking-tight text-slate-900">{total.toLocaleString("pt-BR")}</p>
            </div>
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium">
              <button onClick={() => setRange("monthly")} className={`rounded-full px-3 py-1.5 transition-colors ${range === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Mensal</button>
              <button onClick={() => setRange("yearly")} className={`rounded-full px-3 py-1.5 transition-colors ${range === "yearly" ? "bg-emerald-500 text-white" : "text-slate-500"}`}>Anual</button>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            {/* y labels + gridlines */}
            <div className="flex w-8 flex-col justify-between py-1 text-right text-[10px] text-slate-400" style={{ height: 240 }}>
              {ticks.map((v, i) => <span key={i}>{v}</span>)}
            </div>
            <div className="relative flex-1">
              {/* gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {ticks.map((_, i) => <div key={i} className="border-t border-slate-100" />)}
              </div>
              {/* bars */}
              <div className="relative flex items-end justify-between gap-2" style={{ height: 240 }}>
                {flow.map((d, i) => {
                  const h = (d.leads / max) * 100;
                  const isActive = i === active;
                  return (
                    <div key={d.m} className="group flex h-full flex-1 flex-col items-center justify-end"
                      onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                      <div className="relative flex w-full max-w-[44px] justify-center" style={{ height: `${Math.max(h, 1)}%` }}>
                        {isActive && (
                          <div className="absolute -top-[70px] left-1/2 z-10 w-40 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                            <p className="text-[10px] font-medium text-slate-400">{d.m}</p>
                            <div className="mt-1 flex items-center justify-between text-xs"><span className="text-slate-500">Leads</span><span className="font-semibold text-slate-900">{d.leads}</span></div>
                            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">WhatsApp</span><span className="font-semibold text-emerald-600">{d.wa}</span></div>
                            <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
                          </div>
                        )}
                        <div className={`w-full rounded-t-lg transition-all ${isActive ? "bg-emerald-500" : "bg-slate-100 group-hover:bg-slate-200"}`} style={{ height: "100%" }}>
                          {isActive && <span className="mx-auto block h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="ml-11 mt-2 flex justify-between text-[11px] text-slate-400">
            {flow.map((d) => <span key={d.m} className="flex-1 text-center">{d.m}</span>)}
          </div>
        </div>
      </div>

      {/* atividades recentes */}
      <div className={`${CARD} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-slate-800">Atividades recentes</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-400">
              <Search className="h-4 w-4" /> <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" className="w-24 bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none" />
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"><SlidersHorizontal className="h-4 w-4" /> Filtrar</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 font-medium">Procedimento</th><th className="pb-3 font-medium">Lead</th><th className="pb-3 font-medium">ID</th><th className="pb-3 font-medium">Data</th><th className="pb-3 font-medium">Hora</th><th className="pb-3 text-right font-medium">Score</th><th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/70">
                  <td className="py-3 font-medium text-slate-800">{a.name}</td>
                  <td className="py-3 text-slate-500">{a.who}</td>
                  <td className="py-3 text-slate-400">#{a.id}</td>
                  <td className="py-3 text-slate-500">{a.date}</td>
                  <td className="py-3 text-slate-500">{a.time}</td>
                  <td className="py-3 text-right font-semibold text-slate-900">{a.score}</td>
                  <td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[a.status] ?? STATUS_STYLE.Novo}`}>{a.status}</span></td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">Nenhuma atividade recente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

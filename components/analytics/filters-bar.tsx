"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { RANGES, type RangeKey } from "@/lib/analytics/period";
import { filtersToQuery, type AnalyticsFilters } from "@/lib/analytics/filters";

interface Options { flows: { id: string; name: string }[]; procedures: string[]; sources: string[]; campaigns: string[] }

const SELECT = "h-9 max-w-[11rem] truncate rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-600 shadow-sm outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500/40";

// Filtros na URL: o servidor recalcula tudo no banco a cada mudança.
export function FiltersBar({ filters, options }: { filters: AnalyticsFilters; options: Options }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const set = (patch: Partial<AnalyticsFilters>) => {
    const q = filtersToQuery({ ...filters, ...patch });
    start(() => router.push(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };

  // Mantém a opção escolhida visível mesmo que suma da lista no novo período.
  const withCurrent = (list: string[], cur: string | null) => (cur && !list.includes(cur) ? [cur, ...list] : list);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <select aria-label="Período" className={SELECT} value={filters.range} onChange={(e) => set({ range: e.target.value as RangeKey })}>
        {(Object.keys(RANGES) as RangeKey[]).map((k) => <option key={k} value={k}>{RANGES[k].label}</option>)}
      </select>
      {options.flows.length > 0 && (
        <select aria-label="Funil" className={SELECT} value={filters.flow ?? ""} onChange={(e) => set({ flow: e.target.value || null })}>
          <option value="">Todos os funis</option>
          {options.flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      )}
      {(options.procedures.length > 1 || filters.procedure) && (
        <select aria-label="Procedimento" className={SELECT} value={filters.procedure ?? ""} onChange={(e) => set({ procedure: e.target.value || null })}>
          <option value="">Todos os procedimentos</option>
          {withCurrent(options.procedures, filters.procedure).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      {(options.sources.length > 0 || filters.source) && (
        <select aria-label="Origem" className={SELECT} value={filters.source ?? ""} onChange={(e) => set({ source: e.target.value || null })}>
          <option value="">Todas as origens</option>
          {withCurrent(options.sources, filters.source).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {(options.campaigns.length > 0 || filters.campaign) && (
        <select aria-label="Campanha" className={SELECT} value={filters.campaign ?? ""} onChange={(e) => set({ campaign: e.target.value || null })}>
          <option value="">Todas as campanhas</option>
          {withCurrent(options.campaigns, filters.campaign).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      <button
        type="button"
        onClick={() => start(() => router.refresh())}
        className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <RotateCcw className={`h-4 w-4 text-slate-400 ${pending ? "animate-spin" : ""}`} /> Atualizar
      </button>
    </div>
  );
}

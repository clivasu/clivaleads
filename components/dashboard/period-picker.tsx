"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { DASH_PRESETS, dashQuery, type DashBucket, type DashPresetKey } from "@/lib/dashboard-period";

// Período do Dashboard na URL (?periodo=…&de=…&ate=…): o servidor recalcula.
export function PeriodPicker({ current, de, ate, agrupar, compareLabel }: {
  current: DashPresetKey; de: string; ate: string; agrupar: DashBucket | null; compareLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState(current === "personalizado");
  const [from, setFrom] = useState(de);
  const [to, setTo] = useState(ate);

  const go = (periodo: DashPresetKey, extra: { de?: string; ate?: string } = {}) => {
    // Trocar de período volta ao agrupamento automático (dia/mês/ano).
    const q = dashQuery({ periodo, ...extra, agrupar: periodo === current ? agrupar : null });
    start(() => router.push(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };

  return (
    <div className={`flex flex-col items-start gap-2 sm:items-end ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 text-xs font-medium shadow-sm ring-1 ring-slate-200" role="group" aria-label="Período">
        {DASH_PRESETS.map((p) => {
          const on = p.key === "personalizado" ? custom : current === p.key && !custom;
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={on}
              onClick={() => { if (p.key === "personalizado") setCustom(true); else { setCustom(false); go(p.key); } }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${on ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {p.key === "personalizado" && <CalendarDays className="h-3.5 w-3.5" />}
              {p.label}
            </button>
          );
        })}
      </div>
      {custom && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 text-xs shadow-sm ring-1 ring-slate-200"
          onSubmit={(e) => { e.preventDefault(); if (from && to) go("personalizado", { de: from, ate: to }); }}
        >
          <label className="flex items-center gap-1.5 text-slate-500">De
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700" />
          </label>
          <label className="flex items-center gap-1.5 text-slate-500">até
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700" />
          </label>
          <button type="submit" className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600">Aplicar</button>
        </form>
      )}
      <p className="text-[11px] text-slate-400">Comparação: {compareLabel}</p>
    </div>
  );
}

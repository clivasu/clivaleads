"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HomeData } from "@/lib/data/home";
import type { DashBucket } from "@/lib/dashboard-period";

// Faturamento (atendimentos concluídos × preço) e quantidade de atendimentos
// ao longo do período, por dia, mês ou ano. A linha termina no dia de hoje.
const C = { revenue: "#16a34a", done: "#4a3aa7", grid: "#e9edf2", axis: "#94a3b8" };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const short = (v: number) => (v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `R$${Math.round(v)}`);

function label(bucket: string, unit: DashBucket, long = false) {
  const [y, m, d] = bucket.split("-");
  if (unit === "year") return y;
  if (unit === "month") return long ? `${MONTHS[Number(m) - 1]}/${y}` : MONTHS[Number(m) - 1];
  return long ? `${d}/${m}/${y}` : `${d}/${m}`;
}

const UNITS: [DashBucket, string][] = [["day", "Dia"], ["month", "Mês"], ["year", "Ano"]];

export function RevenueChart({ series, bucket, totals }: Pick<HomeData, "series" | "bucket" | "totals">) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const empty = series.every((p) => !p.revenue && !p.done);

  const setUnit = (u: DashBucket) => {
    const q = new URLSearchParams(params.toString());
    q.set("agrupar", u);
    start(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
  };

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Faturamento × atendimentos</h2>
          <p className="text-sm text-slate-400">
            <b className="font-semibold text-slate-700">{brl(totals.revenue)}</b> em <b className="font-semibold text-slate-700">{totals.done.toLocaleString("pt-BR")}</b> atendimentos concluídos no período
          </p>
        </div>
        <div className={`flex rounded-full bg-slate-100 p-1 text-xs font-medium ${pending ? "opacity-60" : ""}`} role="group" aria-label="Agrupar por">
          {UNITS.map(([u, l]) => (
            <button key={u} type="button" aria-pressed={bucket === u} onClick={() => setUnit(u)}
              className={`rounded-full px-3 py-1.5 transition-colors ${bucket === u ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.revenue }} /> Faturamento</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.done }} /> Atendimentos</span>
      </div>

      {empty ? (
        <p className="flex h-[260px] items-center justify-center text-sm text-slate-400">Nenhum atendimento concluído neste período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.revenue} stopOpacity={0.22} />
                <stop offset="100%" stopColor={C.revenue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="bucket" tickFormatter={(b: string) => label(b, bucket)} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={14} />
            <YAxis yAxisId="r" tickFormatter={short} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
            <YAxis yAxisId="n" orientation="right" allowDecimals={false} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              content={({ active, label: l, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as { revenue: number | null; done: number | null };
                return (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-semibold text-slate-900">{label(String(l), bucket, true)}</p>
                    <p className="flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: C.revenue }} />Faturamento: <b className="text-slate-900">{brl(p.revenue ?? 0)}</b></p>
                    <p className="flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: C.done }} />Atendimentos: <b className="text-slate-900">{p.done ?? 0}</b></p>
                    {p.done ? <p className="mt-1 text-slate-400">Ticket médio: {brl((p.revenue ?? 0) / p.done)}</p> : null}
                  </div>
                );
              }}
            />
            <Area yAxisId="r" type="monotone" dataKey="revenue" stroke={C.revenue} strokeWidth={2.5} fill="url(#revFill)" connectNulls={false} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
            <Line yAxisId="n" type="monotone" dataKey="done" stroke={C.done} strokeWidth={2} dot={false} connectNulls={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

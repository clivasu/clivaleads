"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/data/funnel-analytics";
import type { Bucket } from "@/lib/analytics/period";

// Paleta do painel (mesma do admin): esmeralda principal, violeta comparação.
const SERIES = [
  { key: "visits", label: "Visitas", color: "#94a3b8" },
  { key: "starts", label: "Inícios", color: "#4a3aa7" },
  { key: "completions", label: "Conclusões", color: "#0ea5e9" },
  { key: "leads", label: "Leads", color: "#eda100" },
  { key: "whatsapp", label: "WhatsApp", color: "#059669" },
] as const;
type Key = (typeof SERIES)[number]["key"];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtBucket(b: string, bucket: Bucket, long = false) {
  const [y, m, d] = b.split("-").map(Number);
  if (bucket === "month") return `${MONTHS[m - 1]}${long ? ` ${y}` : ""}`;
  const base = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  return bucket === "week" && long ? `Semana de ${base}` : base;
}

export function SeriesChart({ data, bucket }: { data: SeriesPoint[]; bucket: Bucket }) {
  const [on, setOn] = useState<Set<Key>>(new Set(["visits", "starts", "whatsapp"]));
  const toggle = (k: Key) => setOn((prev) => {
    const next = new Set(prev);
    if (next.has(k)) { if (next.size > 1) next.delete(k); } else next.add(k);
    return next;
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={on.has(s.key)}
            onClick={() => toggle(s.key)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on.has(s.key) ? "border-slate-200 bg-white text-slate-700 shadow-sm" : "border-transparent bg-slate-100 text-slate-400"}`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: on.has(s.key) ? s.color : "#cbd5e1" }} />
            {s.label}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <p className="flex h-[240px] items-center justify-center text-sm text-slate-400">Sem dados no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`sg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#e9edf2" vertical={false} />
            <XAxis dataKey="bucket" tickFormatter={(b: string) => fmtBucket(b, bucket)} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              content={({ active, label, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-semibold text-slate-900">{fmtBucket(String(label), bucket, true)}</p>
                    {payload.map((p) => (
                      <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate-600">
                        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                        {SERIES.find((s) => s.key === p.dataKey)?.label}: <b className="text-slate-900">{Number(p.value).toLocaleString("pt-BR")}</b>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            {SERIES.filter((s) => on.has(s.key)).map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} fill={`url(#sg-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

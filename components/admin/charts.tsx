"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// Gráficos do admin. Paleta validada (guia de dataviz, superfície branca):
// esmeralda #059669 (série principal) + violeta #4a3aa7 (comparação).
// Ganho/perda: esmeralda/vermelho, sempre com posição (acima/abaixo do zero)
// e sinal no rótulo, para não depender só da cor.
export const C = {
  main: "#059669",
  compare: "#4a3aa7",
  third: "#eda100",
  loss: "#e34948",
  grid: "#e9edf2",
  axis: "#94a3b8",
  ink: "#0f172a",
  ink2: "#475569",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (cents: number) => brl.format(cents / 100);
export function moneyShort(cents: number) {
  const v = cents / 100;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

const axisProps = {
  tick: { fill: C.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/* ------------------------------ tooltip ------------------------------ */
interface TipRow { name: string; value: number; color: string; format: (v: number) => string }
function TipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-900">{title}</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
          {r.name}: <b className="text-slate-900">{r.format(r.value)}</b>
        </p>
      ))}
    </div>
  );
}

type TipProps = { active?: boolean; label?: unknown; payload?: readonly { dataKey?: unknown; value?: unknown; color?: string; payload?: Record<string, number> }[] };

/* ------------------------------ MRR ------------------------------ */
export function MrrAreaChart({ data }: { data: { label: string; mrr: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="mrrWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.main} stopOpacity={0.16} />
            <stop offset="100%" stopColor={C.main} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={76} tickFormatter={(v) => moneyShort(v)} />
        <Tooltip
          cursor={{ stroke: C.axis, strokeWidth: 1 }}
          content={({ active, label, payload }: TipProps) =>
            active && payload?.length ? <TipBox title={String(label)} rows={[{ name: "MRR", value: Number(payload[0].value ?? 0), color: C.main, format: money }]} /> : null}
        />
        <Area type="monotone" dataKey="mrr" stroke={C.main} strokeWidth={2} fill="url(#mrrWash)"
          dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: C.main }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ----------------------- novos x cancelamentos ----------------------- */
export function MovementChart({ data }: { data: { label: string; novos: number; cancelados: number }[] }) {
  const rows = data.map((d) => ({ ...d, cancelNeg: -d.cancelados }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} stackOffset="sign" margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={32} allowDecimals={false} tickFormatter={(v) => String(Math.abs(v))} />
        <ReferenceLine y={0} stroke="#cbd5e1" />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.08)" }}
          content={({ active, label, payload }: TipProps) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload ?? {};
            return <TipBox title={String(label)} rows={[
              { name: "Novos pagantes", value: p.novos ?? 0, color: C.main, format: (v) => `+${v}` },
              { name: "Cancelamentos", value: p.cancelados ?? 0, color: C.loss, format: (v) => `−${v}` },
            ]} />;
          }}
        />
        <Bar dataKey="novos" stackId="m" fill={C.main} maxBarSize={24} radius={[4, 4, 0, 0]} />
        {/* barra negativa: ponta arredondada embaixo, reta no zero */}
        <Bar dataKey="cancelNeg" stackId="m" fill={C.loss} maxBarSize={24} radius={[0, 0, 4, 4]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------- cadastros por dia ------------------------- */
export function SignupsChart({ data }: { data: { label: string; cadastros: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval={4} />
        <YAxis {...axisProps} width={28} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.08)" }}
          content={({ active, label, payload }: TipProps) =>
            active && payload?.length ? <TipBox title={String(label)} rows={[{ name: "Cadastros", value: Number(payload[0].value ?? 0), color: C.main, format: String }]} /> : null}
        />
        <Bar dataKey="cadastros" fill={C.main} maxBarSize={14} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------- receita x custos ------------------------- */
export function RevenueCostChart({ data }: { data: { label: string; receita: number; custos: number; taxas: number }[] }) {
  const rows = data.map((d) => ({ ...d, saidas: d.custos + d.taxas }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} barGap={2} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={76} tickFormatter={(v) => moneyShort(v)} />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.08)" }}
          content={({ active, label, payload }: TipProps) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload ?? {};
            return <TipBox title={String(label)} rows={[
              { name: "Receita", value: p.receita ?? 0, color: C.main, format: money },
              { name: "Custos", value: p.custos ?? 0, color: C.compare, format: money },
              { name: "Taxas Stripe", value: p.taxas ?? 0, color: C.compare, format: money },
            ]} />;
          }}
        />
        <Bar dataKey="receita" fill={C.main} maxBarSize={20} radius={[4, 4, 0, 0]} />
        <Bar dataKey="saidas" fill={C.compare} maxBarSize={20} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------- resultado --------------------------- */
export function ResultChart({ data }: { data: { label: string; resultado: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={76} tickFormatter={(v) => moneyShort(v)} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.08)" }}
          content={({ active, label, payload }: TipProps) => {
            if (!active || !payload?.length) return null;
            const v = Number(payload[0].value ?? 0);
            return <TipBox title={String(label)} rows={[{ name: v >= 0 ? "Lucro" : "Prejuízo", value: v, color: v >= 0 ? C.main : C.loss, format: (x) => `${x >= 0 ? "+" : "−"}${money(Math.abs(x))}` }]} />;
          }}
        />
        <Bar dataKey="resultado" maxBarSize={24}
          shape={(props: unknown) => {
            const p = props as { x: number; y: number; width: number; height: number; payload: { resultado: number } };
            const neg = p.payload.resultado < 0;
            const h = Math.abs(p.height);
            const top = p.height < 0 ? p.y + p.height : p.y;
            const r = Math.min(4, h, p.width / 2);
            const x = p.x, w = p.width, y = top;
            // ponta (longe do zero) arredondada; lado do zero reto
            const d = neg
              ? `M${x},${y} H${x + w} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} Z`
              : `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
            return <path d={d} fill={neg ? C.loss : C.main} />;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CumulativeChart({ data }: { data: { label: string; acumulado: number }[] }) {
  const min = Math.min(0, ...data.map((d) => d.acumulado));
  const max = Math.max(0, ...data.map((d) => d.acumulado));
  const zeroAt = max === min ? 0.5 : max / (max - min); // onde o zero cai no degradê
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cumStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset={zeroAt} stopColor={C.main} />
            <stop offset={zeroAt} stopColor={C.loss} />
          </linearGradient>
          <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor={C.main} stopOpacity={0.14} />
            <stop offset={zeroAt} stopColor={C.main} stopOpacity={0.04} />
            <stop offset={zeroAt} stopColor={C.loss} stopOpacity={0.04} />
            <stop offset={1} stopColor={C.loss} stopOpacity={0.14} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={76} tickFormatter={(v) => moneyShort(v)} />
        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="0" label={{ value: "ponto de equilíbrio", position: "insideTopLeft", fill: C.axis, fontSize: 10 }} />
        <Tooltip
          cursor={{ stroke: C.axis, strokeWidth: 1 }}
          content={({ active, label, payload }: TipProps) => {
            if (!active || !payload?.length) return null;
            const v = Number(payload[0].value ?? 0);
            return <TipBox title={String(label)} rows={[{ name: "Acumulado", value: v, color: v >= 0 ? C.main : C.loss, format: (x) => `${x >= 0 ? "+" : "−"}${money(Math.abs(x))}` }]} />;
          }}
        />
        <Area type="monotone" dataKey="acumulado" stroke="url(#cumStroke)" strokeWidth={2} fill="url(#cumFill)" dot={false}
          activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: C.ink2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* --------------------------- sparkline --------------------------- */
export function Sparkline({ values, color = C.main }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const w = 96, h = 28;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke="#cbd5e1" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={pts[pts.length - 1].split(",")[1]} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

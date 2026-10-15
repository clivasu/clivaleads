"use client";

import type { HomeData } from "@/lib/data/home";

const W = 640;
const H = 280;
const PAD_L = 52;
const PAD_R = 12;
const PAD_T = 24;
const PAD_B = 34;

// Escala "redonda" acima do maior valor (ex.: 56.380 -> 60.000).
function niceMax(v: number) {
  if (v <= 0) return 6000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return (steps.find((s) => s * p >= v * 1.08) ?? 10) * p;
}
const short = (v: number) => (v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `R$${Math.round(v)}`);

// Catmull-Rom -> cubic bezier para uma curva suave.
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function RevenueChart({ data }: { data: HomeData["revenue"] }) {
  const empty = data.length === 0 || data.every((d) => d.value === 0);
  const series = data.length > 1 ? data : [{ label: "", value: 0 }, { label: "", value: 0 }];
  const yMax = niceMax(Math.max(...series.map((d) => d.value)));
  const scaleX = (i: number) => PAD_L + (i / (series.length - 1)) * (W - PAD_L - PAD_R);
  const scaleY = (v: number) => PAD_T + (1 - v / yMax) * (H - PAD_T - PAD_B);
  const pts = series.map((d, i) => ({ x: scaleX(i), y: scaleY(d.value) }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;

  const peakIdx = series.reduce((mi, d, i, arr) => (d.value > arr[mi].value ? i : mi), 0);
  const peak = pts[peakIdx];
  // Mantém o balão do pico dentro do viewBox (não corta nas bordas).
  const BALLOON_HW = 50;
  const balloonCX = Math.min(W - PAD_R - BALLOON_HW, Math.max(PAD_L + BALLOON_HW, peak.x));
  const balloonAbove = peak.y - 34 > PAD_T;
  const balloonY = balloonAbove ? peak.y - 34 : peak.y + 12;
  const balloonTextY = balloonAbove ? peak.y - 19 : peak.y + 27;
  const gridVals = [0, 1, 2, 3, 4, 5, 6].map((k) => (yMax / 6) * k);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Receita</h2>
        <p className="text-sm text-slate-400">Atendimentos concluídos por mês</p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Receita mensal: ${data.map((d) => `${d.label} ${short(d.value)}`).join(", ")}`}>
        <defs>
          <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#84cc16" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {gridVals.map((gv) => {
          const y = scaleY(gv);
          return (
            <g key={gv}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f1f5f9" strokeWidth={1} />
              <text x={PAD_L - 10} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize={11}>
                {short(gv)}
              </text>
            </g>
          );
        })}

        {/* área + linha */}
        <path d={area} fill="url(#revArea)" />
        <path d={line} fill="none" stroke="#84cc16" strokeWidth={3} strokeLinecap="round" />

        {/* pico + balão (só quando há dados) */}
        {!empty && (
          <>
            <line x1={peak.x} y1={peak.y} x2={peak.x} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={peak.x} cy={peak.y} r={5} fill="#84cc16" stroke="#fff" strokeWidth={2} />
            <g>
              <rect x={balloonCX - BALLOON_HW} y={balloonY} width={BALLOON_HW * 2} height={22} rx={11} fill="#dcfce7" />
              <text x={balloonCX} y={balloonTextY} textAnchor="middle" className="fill-emerald-700" fontSize={11} fontWeight={600}>
                {series[peakIdx].value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
              </text>
            </g>
          </>
        )}
        {empty && (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-slate-300" fontSize={13} fontWeight={500}>
            Sem receita registrada ainda
          </text>
        )}

        {/* x labels */}
        {series.map((d, i) => (
          <text key={`${d.label}-${i}`} x={scaleX(i)} y={H - 10} textAnchor="middle" className="fill-slate-400" fontSize={11}>
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

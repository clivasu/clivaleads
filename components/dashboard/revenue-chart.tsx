"use client";

import { useState } from "react";
import { revenueLabels, revenueRanges, type RevenueRange } from "@/lib/demo-dashboard";

const LABELS = revenueLabels;

const W = 640;
const H = 280;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 24;
const PAD_B = 34;
const Y_MAX = 36;

function scaleX(i: number, n: number) {
  return PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
}
function scaleY(v: number) {
  return PAD_T + (1 - v / Y_MAX) * (H - PAD_T - PAD_B);
}

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

export function RevenueChart() {
  const [range, setRange] = useState<RevenueRange>("overview");
  const data = revenueRanges[range];
  const pts = data.map((v, i) => ({ x: scaleX(i, data.length), y: scaleY(v) }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;

  const peakIdx = data.indexOf(Math.max(...data));
  const peak = pts[peakIdx];
  // Mantém o balão do pico dentro do viewBox (não corta nas bordas).
  const BALLOON_HW = 46; // meia-largura do balão
  const balloonCX = Math.min(W - PAD_R - BALLOON_HW, Math.max(PAD_L + BALLOON_HW, peak.x));
  // Se o pico está muito no topo, joga o balão para baixo do ponto.
  const balloonAbove = peak.y - 34 > PAD_T;
  const balloonY = balloonAbove ? peak.y - 34 : peak.y + 12;
  const balloonTextY = balloonAbove ? peak.y - 19 : peak.y + 27;
  const gridVals = [0, 6, 12, 18, 24, 30, 36];

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Receita</h2>
          <p className="text-sm text-slate-400">Desempenho dos últimos meses</p>
        </div>
        <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium">
          {(["overview", "monthly", "yearly"] as RevenueRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                range === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {r === "overview" ? "Geral" : r === "monthly" ? "Mensal" : "Anual"}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de receita">
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
                R${gv.toString().padStart(2, "0")}k
              </text>
            </g>
          );
        })}

        {/* área + linha */}
        <path d={area} fill="url(#revArea)" />
        <path d={line} fill="none" stroke="#84cc16" strokeWidth={3} strokeLinecap="round" />

        {/* linha vertical do pico */}
        <line x1={peak.x} y1={peak.y} x2={peak.x} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
        <circle cx={peak.x} cy={peak.y} r={5} fill="#84cc16" stroke="#fff" strokeWidth={2} />

        {/* balão do pico */}
        <g>
          <rect x={balloonCX - BALLOON_HW} y={balloonY} width={BALLOON_HW * 2} height={22} rx={11} fill="#dcfce7" />
          <text x={balloonCX} y={balloonTextY} textAnchor="middle" className="fill-emerald-700" fontSize={11} fontWeight={600}>
            R$ {(data[peakIdx] * 1000).toLocaleString("pt-BR")}
          </text>
        </g>

        {/* x labels */}
        {LABELS.map((l, i) => (
          <text key={l} x={scaleX(i, LABELS.length)} y={H - 10} textAnchor="middle" className="fill-slate-400" fontSize={11}>
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

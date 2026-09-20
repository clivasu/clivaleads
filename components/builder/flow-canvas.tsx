"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Sparkles, Minus, Maximize2 } from "lucide-react";
import type { FlowStep, StepType } from "@/lib/types";
import { BLOCK_CATALOG } from "@/lib/block-catalog";
import { cn } from "@/lib/utils";

const LABELS = Object.fromEntries(BLOCK_CATALOG.map((b) => [b.type, b.label])) as Record<StepType, string>;

const NODE_W = 210;
const GAP_X = 74;
const ROW_H = 258;
const PER_ROW = 4;
const ORIGIN = { x: 48, y: 40 };
const HEADER_H = 37;
const BODY_TOP = 8;
const ITEM_H = 24;
const METRIC_H = 24;

type XY = { x: number; y: number };

/* ---- métricas (demo) da jornada por bloco ---- */
const DROP: Partial<Record<StepType, number>> = {
  start: 0.06, hero: 0.05, question: 0.1, multi_choice: 0.12, rating: 0.14, form: 0.28,
  timer: 0.16, loading: 0.03, buttons: 0.1, result: 0.05, spin_wheel: 0.08, whatsapp: 0, container: 0.04,
};
const RET: Partial<Record<StepType, number>> = { question: 0.08, multi_choice: 0.09, rating: 0.1, faq: 0.12, form: 0.06 };
const TIM: Partial<Record<StepType, number>> = {
  text: 22, news: 26, video: 30, question: 9, multi_choice: 11, rating: 12, form: 25, loading: 3,
  before_after: 14, carousel: 16, faq: 18, hero: 8, timer: 15, stats: 12, testimonial: 16,
};

interface Metric { id: string; i: number; reached: number; exit: number; dropPct: number; returns: number; time: number }

function computeMetrics(steps: FlowStep[], base = 138) {
  let leads = base;
  const per: Metric[] = steps.map((s, i) => {
    const dr = s.type === "whatsapp" ? 0 : DROP[s.type] ?? 0.045;
    const reached = Math.round(leads);
    const after = Math.round(leads * (1 - dr));
    const exit = reached - after;
    leads = after;
    return { id: s.id, i, reached, exit, dropPct: reached ? Math.round((exit / reached) * 100) : 0, returns: Math.round(reached * (RET[s.type] ?? 0.03)), time: TIM[s.type] ?? 10 };
  });
  const byId = new Map(per.map((m) => [m.id, m]));
  const pick = (key: keyof Metric) => per.reduce((a, b) => ((b[key] as number) > (a[key] as number) ? b : a), per[0]);
  return {
    byId,
    total: base,
    completed: per.length ? per[per.length - 1].reached : 0,
    worstExit: per.length ? pick("exit") : null,
    mostReturns: per.length ? pick("returns") : null,
    mostTime: per.length ? pick("time") : null,
  };
}

interface Node {
  step: FlowStep;
  i: number;
  x: number;
  y: number;
  h: number;
  rows: string[];
  isChoice: boolean;
}

function rowsFor(step: FlowStep): string[] {
  const c = step.config;
  if (step.type === "question" || step.type === "multi_choice") {
    return (c.options ?? []).slice(0, 5).map((o) => o.label);
  }
  if (step.type === "faq") return (c.faqs ?? []).slice(0, 4).map((f) => f.q);
  if (step.type === "stats") return (c.stats ?? []).slice(0, 3).map((s) => `${s.value} ${s.label}`);
  if (c.title) return [c.title];
  if (c.body) return [c.body.slice(0, 40)];
  if (c.button_label) return [c.button_label];
  return ["—"];
}

const handleY = (n: Node, k: number) => n.y + HEADER_H + BODY_TOP + k * ITEM_H + ITEM_H / 2;

function curve(sx: number, sy: number, tx: number, ty: number) {
  const c = Math.max(40, Math.abs(tx - sx) * 0.4);
  return `M ${sx} ${sy} C ${sx + c} ${sy}, ${tx - c} ${ty}, ${tx} ${ty}`;
}

// Aresta sequencial (snake) entre dois nós.
function seqPath(a: Node, b: Node) {
  const ay = a.y + a.h / 2, by = b.y + b.h / 2;
  if (Math.abs(a.x - b.x) < 4) {
    const sx = a.x + NODE_W / 2, sy = a.y + a.h, tx = b.x + NODE_W / 2, ty = b.y;
    return `M ${sx} ${sy} C ${sx} ${sy + 40}, ${tx} ${ty - 40}, ${tx} ${ty}`;
  }
  if (b.x > a.x) return curve(a.x + NODE_W, ay, b.x, by);
  return `M ${a.x} ${ay} C ${a.x - 45} ${ay}, ${b.x + NODE_W + 45} ${by}, ${b.x + NODE_W} ${by}`;
}

export function FlowCanvas({
  steps, selectedId, positions, onSelect, onEdit, onAddStep, onMoveNode, onResetLayout, onSetBranch,
}: {
  steps: FlowStep[];
  selectedId: string;
  positions: Record<string, XY>;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onAddStep: () => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onResetLayout: () => void;
  onSetBranch: (stepId: string, optIndex: number, next: number | undefined) => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [connect, setConnect] = useState<{ fromId: string; optIndex: number; fx: number; fy: number; cx: number; cy: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const nodes: Node[] = useMemo(() => {
    return steps.map((step, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = i % PER_ROW;
      const col = row % 2 === 0 ? inRow : PER_ROW - 1 - inRow;
      const rows = rowsFor(step);
      const base = { x: ORIGIN.x + col * (NODE_W + GAP_X), y: ORIGIN.y + row * ROW_H };
      const p = positions[step.id] ?? base;
      return {
        step, i, x: p.x, y: p.y, rows,
        h: HEADER_H + BODY_TOP + rows.length * ITEM_H + 8 + METRIC_H,
        isChoice: step.type === "question" || step.type === "multi_choice",
      };
    });
  }, [steps, positions]);

  const metrics = useMemo(() => computeMetrics(steps), [steps]);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.step.id, n])), [nodes]);

  const branches = useMemo(() => {
    const out: { fromId: string; optIndex: number; sx: number; sy: number; tx: number; ty: number }[] = [];
    nodes.forEach((n) => {
      (n.step.config.options ?? []).slice(0, 5).forEach((o, k) => {
        const target = typeof o.next === "number" ? nodes[o.next] : undefined;
        if (target) out.push({ fromId: n.step.id, optIndex: k, sx: n.x + NODE_W, sy: handleY(n, k), tx: target.x, ty: target.y + target.h / 2 });
      });
    });
    return out;
  }, [nodes]);

  const bounds = nodes.reduce(
    (b, n) => ({ w: Math.max(b.w, n.x + NODE_W + 80), h: Math.max(b.h, n.y + n.h + 80) }),
    { w: 900, h: 560 },
  );

  const toCanvas = (e: React.MouseEvent): XY => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
  };

  const onBgDown = (e: React.MouseEvent) => {
    panRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const onMove = (e: React.MouseEvent) => {
    if (connect) {
      const p = toCanvas(e);
      setConnect((c) => (c ? { ...c, cx: p.x, cy: p.y } : c));
      return;
    }
    if (dragRef.current) {
      const p = toCanvas(e);
      const dx = p.x - dragRef.current.sx, dy = p.y - dragRef.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
      onMoveNode(dragRef.current.id, dragRef.current.ox + dx, dragRef.current.oy + dy);
      return;
    }
    if (panRef.current) {
      setPan({ x: panRef.current.px + (e.clientX - panRef.current.mx), y: panRef.current.py + (e.clientY - panRef.current.my) });
    }
  };
  const onUp = () => {
    if (connect) setConnect(null);
    if (dragRef.current && !dragRef.current.moved) onSelect(dragRef.current.id);
    dragRef.current = null;
    panRef.current = null;
  };

  const autoOrganize = () => { onResetLayout(); setPan({ x: 0, y: 0 }); setZoom(0.85); };

  return (
    <div className="relative flex-1 overflow-hidden bg-slate-50">
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

      <div className="absolute left-4 top-4 z-20 flex gap-2">
        <button onClick={onAddStep} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
          <Plus className="h-4 w-4" /> Adicionar etapa
        </button>
        <button onClick={autoOrganize} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          <Sparkles className="h-4 w-4" /> Auto-organizar
        </button>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow-sm">
        Arraste os nós • puxe a bolinha de uma opção até outra etapa para ramificar
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex max-w-[340px] flex-wrap gap-2">
        <MiniStat label="Interação" value="86%" sub="interagiram" />
        <MiniStat label="Leads" value={String(metrics.total)} sub="iniciaram" />
        {metrics.worstExit && (
          <MiniStat label="Maior saída" value={`${LABELS[steps[metrics.worstExit.i]?.type]}`} sub={`${metrics.worstExit.exit} leads (${metrics.worstExit.dropPct}%)`} accent="rose" />
        )}
        {metrics.mostReturns && (
          <MiniStat label="Mais voltou" value={`${LABELS[steps[metrics.mostReturns.i]?.type]}`} sub={`${metrics.mostReturns.returns} retornos`} accent="amber" />
        )}
        {metrics.mostTime && (
          <MiniStat label="Mais demorou" value={`${LABELS[steps[metrics.mostTime.i]?.type]}`} sub={`~${metrics.mostTime.time}s p/ clicar`} accent="sky" />
        )}
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <button onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} className="p-2 hover:bg-slate-50"><Plus className="h-4 w-4" /></button>
        <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} className="border-t p-2 hover:bg-slate-50"><Minus className="h-4 w-4" /></button>
        <button onClick={autoOrganize} className="border-t p-2 hover:bg-slate-50"><Maximize2 className="h-4 w-4" /></button>
      </div>

      <div
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={onBgDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
          <svg width={bounds.w} height={bounds.h} className="absolute left-0 top-0 overflow-visible">
            {nodes.slice(0, -1).map((n, i) => (
              <path key={"e" + i} d={seqPath(n, nodes[i + 1])} fill="none" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="5 5" />
            ))}
            {branches.map((b, i) => (
              <g key={"b" + i} className="cursor-pointer" onClick={() => onSetBranch(b.fromId, b.optIndex, undefined)}>
                <path d={curve(b.sx, b.sy, b.tx, b.ty)} fill="none" stroke="transparent" strokeWidth={12} />
                <path d={curve(b.sx, b.sy, b.tx, b.ty)} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" />
              </g>
            ))}
            {connect && (
              <path d={curve(connect.fx, connect.fy, connect.cx, connect.cy)} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" />
            )}
          </svg>

          {nodes.map((n) => (
            <div
              key={n.step.id}
              onMouseDown={(e) => {
                e.stopPropagation();
                const p = toCanvas(e);
                dragRef.current = { id: n.step.id, sx: p.x, sy: p.y, ox: n.x, oy: n.y, moved: false };
              }}
              onMouseUp={(e) => {
                if (connect && connect.fromId !== n.step.id) {
                  onSetBranch(connect.fromId, connect.optIndex, n.i);
                  setConnect(null);
                  e.stopPropagation();
                }
              }}
              onDoubleClick={() => { onSelect(n.step.id); onEdit(); }}
              title="Duplo-clique para editar este bloco"
              className={cn(
                "absolute select-none rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
                metrics.worstExit?.id === n.step.id ? "border-rose-300 ring-2 ring-rose-200" : n.step.id === selectedId ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200",
              )}
              style={{ left: n.x, top: n.y, width: NODE_W, cursor: "grab" }}
            >
              {metrics.worstExit?.id === n.step.id && (
                <span className="absolute -top-2.5 left-3 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">Maior saída</span>
              )}
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="truncate text-sm font-semibold text-slate-800">{n.i + 1}. {LABELS[n.step.type]}</span>
                <span className="text-slate-300">→</span>
              </div>
              <div className="relative p-2">
                {n.rows.map((r, ri) => (
                  <div key={ri} className="relative flex h-6 items-center truncate rounded px-2 text-xs text-slate-500">
                    <span className="truncate">{r}</span>
                    {n.isChoice && (
                      <span
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const fx = n.x + NODE_W, fy = handleY(n, ri);
                          const p = toCanvas(e);
                          setConnect({ fromId: n.step.id, optIndex: ri, fx, fy, cx: p.x, cy: p.y });
                        }}
                        title="Arraste até uma etapa para ramificar"
                        className="absolute -right-[15px] top-1/2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-emerald-400 hover:scale-125"
                      />
                    )}
                  </div>
                ))}
              </div>
              {(() => {
                const m = metrics.byId.get(n.step.id);
                if (!m) return null;
                const cor = m.dropPct >= 15 ? "text-rose-600" : m.dropPct >= 8 ? "text-amber-600" : "text-emerald-600";
                return (
                  <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px]">
                    <span className="font-medium text-slate-500">{m.reached} leads</span>
                    <span className={cn("font-semibold", cor)}>↓ {m.dropPct}% saída</span>
                  </div>
                );
              })()}
              <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300" />
              {!n.isChoice && <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: "rose" | "amber" | "sky" }) {
  const dot = accent === "rose" ? "bg-rose-500" : accent === "amber" ? "bg-amber-500" : accent === "sky" ? "bg-sky-500" : "bg-slate-300";
  return (
    <div className="w-[158px] rounded-xl bg-white p-3 shadow-lg">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
      </p>
      <p className="mt-0.5 truncate text-[15px] font-bold leading-tight text-slate-900">{value}</p>
      <p className="truncate text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

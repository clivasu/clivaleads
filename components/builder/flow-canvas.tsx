"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Sparkles, Minus, Maximize2, Play, Pause, BarChart3, X, Users } from "lucide-react";
import type { FlowStep, StepType } from "@/lib/types";
import { BLOCK_CATALOG } from "@/lib/block-catalog";
import { computeFlowMetrics, type JourneyLead, buildJourneys } from "@/lib/flow-journeys";
import { GOTO_EXIT, resolveGoto } from "@/lib/flow-logic";
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

// Paleta para as bolinhas de leads (distingue várias pessoas ao mesmo tempo).
const BALL_PALETTE = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#0ea5e9", "#a855f7", "#ec4899", "#14b8a6"];
const MAX_BALLS = 30;
const T_LINE = 900;   // ms percorrendo uma linha
const T_CARD = 620;   // ms completando a borda de um card

type XY = { x: number; y: number };
type Cubic = { p0: XY; p1: XY; p2: XY; p3: XY };

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

// Geometria (cubic bezier) da aresta sequencial entre dois nós — casa com seqPath.
function seqGeom(a: Node, b: Node): Cubic {
  const ay = a.y + a.h / 2, by = b.y + b.h / 2;
  if (Math.abs(a.x - b.x) < 4) {
    const sx = a.x + NODE_W / 2, sy = a.y + a.h, tx = b.x + NODE_W / 2, ty = b.y;
    return { p0: { x: sx, y: sy }, p1: { x: sx, y: sy + 40 }, p2: { x: tx, y: ty - 40 }, p3: { x: tx, y: ty } };
  }
  if (b.x > a.x) {
    const sx = a.x + NODE_W, sy = ay, tx = b.x, ty = by;
    const c = Math.max(40, Math.abs(tx - sx) * 0.4);
    return { p0: { x: sx, y: sy }, p1: { x: sx + c, y: sy }, p2: { x: tx - c, y: ty }, p3: { x: tx, y: ty } };
  }
  return { p0: { x: a.x, y: ay }, p1: { x: a.x - 45, y: ay }, p2: { x: b.x + NODE_W + 45, y: by }, p3: { x: b.x + NODE_W, y: by } };
}
function seqPath(a: Node, b: Node) {
  const g = seqGeom(a, b);
  return `M ${g.p0.x} ${g.p0.y} C ${g.p1.x} ${g.p1.y}, ${g.p2.x} ${g.p2.y}, ${g.p3.x} ${g.p3.y}`;
}
function bezierAt(g: Cubic, t: number): XY {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return { x: a * g.p0.x + b * g.p1.x + c * g.p2.x + d * g.p3.x, y: a * g.p0.y + b * g.p1.y + c * g.p2.y + d * g.p3.y };
}

interface AnimBall {
  id: string;
  name: string;
  color: string;
  path: number[];   // índices de etapa
  segs: Cubic[];    // curvas entre etapas consecutivas
  delay: number;    // atraso de entrada (stagger)
  total: number;    // duração total da jornada
}

function phaseAt(b: AnimBall, local: number):
  | { kind: "card"; node: number; prog: number }
  | { kind: "line"; seg: number; prog: number }
  | { kind: "end" } {
  let acc = 0;
  if (local < acc + T_CARD) return { kind: "card", node: b.path[0], prog: (local - acc) / T_CARD };
  acc += T_CARD;
  for (let k = 0; k < b.segs.length; k++) {
    if (local < acc + T_LINE) return { kind: "line", seg: k, prog: (local - acc) / T_LINE };
    acc += T_LINE;
    if (local < acc + T_CARD) return { kind: "card", node: b.path[k + 1], prog: (local - acc) / T_CARD };
    acc += T_CARD;
  }
  return { kind: "end" };
}

export function FlowCanvas({
  steps, leads = [], selectedId, positions, onSelect, onEdit, onAddStep, onMoveNode, onResetLayout, onSetBranch,
}: {
  steps: FlowStep[];
  leads?: JourneyLead[];
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
  const [statsOpen, setStatsOpen] = useState(false);

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

  const metrics = useMemo(() => computeFlowMetrics(steps, leads), [steps, leads]);
  const journeys = useMemo(() => buildJourneys(steps, leads), [steps, leads]);
  const hasLeads = leads.length > 0;

  /* ---------------- simulação: bolinhas seguindo as linhas ---------------- */
  const [playing, setPlaying] = useState(false);
  const [runId, setRunId] = useState(0);
  const ballEls = useRef<(HTMLDivElement | null)[]>([]);

  const animBalls: AnimBall[] = useMemo(() => {
    return journeys.slice(0, MAX_BALLS).map((j, idx) => {
      const segs: Cubic[] = [];
      for (let k = 0; k < j.path.length - 1; k++) segs.push(seqGeom(nodes[j.path[k]], nodes[j.path[k + 1]]));
      return {
        id: j.id, name: j.name, color: BALL_PALETTE[idx % BALL_PALETTE.length],
        path: j.path, segs, delay: idx * 520, total: T_CARD + segs.length * (T_LINE + T_CARD),
      };
    });
  }, [journeys, nodes]);

  const cycle = useMemo(() => animBalls.reduce((m, b) => Math.max(m, b.delay + b.total), 0) + 1400, [animBalls]);

  useEffect(() => { setPlaying(hasLeads); }, [hasLeads]);

  useEffect(() => {
    if (!playing || animBalls.length === 0) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) % cycle;
      animBalls.forEach((b, bi) => {
        const el = ballEls.current[bi];
        if (!el) return;
        const local = t - b.delay;
        if (local < 0 || local > b.total) { el.style.opacity = "0"; return; }
        const ph = phaseAt(b, local);
        // Dentro do card a bolinha some (sem luz na borda) e reaparece na próxima linha.
        if (ph.kind === "line") {
          const pt = bezierAt(b.segs[ph.seg], ph.prog);
          el.style.opacity = "1";
          el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%)`;
          el.style.background = b.color;
          el.style.boxShadow = `0 0 0 3px ${b.color}33, 0 2px 6px ${b.color}55`;
        } else {
          el.style.opacity = "0";
        }
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, animBalls, cycle, runId]);

  const branches = useMemo(() => {
    const out: { fromId: string; optIndex: number; sx: number; sy: number; tx: number; ty: number; exit: boolean }[] = [];
    const list = nodes.map((n) => n.step);
    nodes.forEach((n) => {
      (n.step.config.options ?? []).slice(0, 5).forEach((o, k) => {
        const r = resolveGoto(list, o.goto, o.next);
        const target = typeof r === "number" ? nodes[r] : undefined;
        if (target && target !== n) out.push({
          fromId: n.step.id, optIndex: k, sx: n.x + NODE_W, sy: handleY(n, k), tx: target.x, ty: target.y + target.h / 2,
          exit: o.goto === GOTO_EXIT || target.step.type === "exit",
        });
      });
    });
    return out;
  }, [nodes]);

  const bounds = nodes.reduce(
    (b, n) => ({ w: Math.max(b.w, n.x + NODE_W + 80), h: Math.max(b.h, n.y + n.h + 120) }),
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
  const toggleSim = () => { if (!hasLeads) return; if (playing) setPlaying(false); else { setRunId((r) => r + 1); setPlaying(true); } };

  return (
    <div className="relative flex-1 overflow-hidden bg-[#fbfbfe]">
      {/* grid estilo Funnelytics */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(59, 70, 196, 0.05) 0px, rgba(59, 70, 196, 0.05) 1px, transparent 1px, transparent 36px), repeating-linear-gradient(0deg, rgba(59, 70, 196, 0.05) 0px, rgba(59, 70, 196, 0.05) 1px, transparent 1px, transparent 36px)",
        }}
      />

      <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
        <button onClick={onAddStep} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
          <Plus className="h-4 w-4" /> Adicionar etapa
        </button>
        <button onClick={autoOrganize} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          <Sparkles className="h-4 w-4" /> Auto-organizar
        </button>
        <button
          onClick={toggleSim}
          disabled={!hasLeads}
          title={hasLeads ? "Reproduzir a jornada real dos leads" : "Sem leads para simular ainda"}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm",
            hasLeads ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600" : "cursor-not-allowed bg-white text-slate-300",
          )}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Pausar simulação" : "Simular leads"}
        </button>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow-sm">
        Arraste os nós • puxe a bolinha de uma opção até outra etapa para ramificar
      </div>

      {/* Stats minimizado (bolinha) + painel vertical */}
      <div className="absolute bottom-4 left-4 z-30">
        <button
          onClick={() => setStatsOpen((s) => !s)}
          className={cn(
            "flex items-center gap-2 rounded-full py-2 pl-2 pr-3 text-xs font-semibold shadow-lg transition-colors",
            statsOpen ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50",
          )}
          title="Ver estatísticas do funil"
        >
          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", statsOpen ? "bg-white/20" : "bg-emerald-100")}>
            <BarChart3 className={cn("h-3.5 w-3.5", statsOpen ? "text-white" : "text-emerald-600")} />
          </span>
          {metrics.total} leads
        </button>
      </div>

      {statsOpen && (
        <div className="absolute bottom-4 left-4 top-20 z-30 flex w-[224px] flex-col gap-2 overflow-y-auto rounded-2xl border bg-white/95 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Estatísticas</span>
            <button onClick={() => setStatsOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          {!hasLeads ? (
            <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">
              Ainda sem leads reais neste funil. As métricas aparecem aqui quando alguém responder.
            </div>
          ) : (
            <>
              <StatRow label="Interação" value={`${metrics.interactionPct}%`} sub="interagiram" />
              <StatRow label="Leads" value={String(metrics.total)} sub="iniciaram" />
              <StatRow label="Concluíram" value={String(metrics.completed)} sub="chegaram ao fim" accent="emerald" />
              {metrics.worstExit && (
                <StatRow label="Maior saída" value={`${LABELS[steps[metrics.worstExit.i]?.type]}`} sub={`${metrics.worstExit.exit} leads (${metrics.worstExit.dropPct}%)`} accent="rose" />
              )}
            </>
          )}
        </div>
      )}

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
            {nodes.slice(0, -1).map((n, i) => (n.step.type === "exit" || nodes[i + 1].step.type === "exit" ? null : (
              <path key={"e" + i} d={seqPath(n, nodes[i + 1])} fill="none" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="5 5" />
            )))}
            {branches.map((b, i) => (
              <g key={"b" + i} className="cursor-pointer" onClick={() => onSetBranch(b.fromId, b.optIndex, undefined)}>
                <path d={curve(b.sx, b.sy, b.tx, b.ty)} fill="none" stroke="transparent" strokeWidth={12} />
                <path d={curve(b.sx, b.sy, b.tx, b.ty)} fill="none" stroke={b.exit ? "#f43f5e" : "#10b981"} strokeWidth={2} strokeDasharray="5 4" />
              </g>
            ))}
            {connect && (
              <path d={curve(connect.fx, connect.fy, connect.cx, connect.cy)} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" />
            )}
          </svg>

          {nodes.map((n) => {
            const m = metrics.perStep[n.i];
            const cor = m && m.dropPct >= 15 ? "text-rose-600" : m && m.dropPct >= 8 ? "text-amber-600" : "text-emerald-600";
            const stoppedHeads = m ? [...m.exits.map((e) => ({ ...e, completed: false })), ...m.completed.map((e) => ({ ...e, completed: true }))] : [];
            return (
            <div key={n.step.id} className="absolute" style={{ left: n.x, top: n.y, width: NODE_W }}>
              <div
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
                  "relative select-none rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
                  n.step.type === "exit" ? cn("border-rose-200 bg-rose-50/60", n.step.id === selectedId && "ring-2 ring-rose-200")
                    : metrics.worstExit?.i === n.i ? "border-rose-300 ring-2 ring-rose-200" : n.step.id === selectedId ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200",
                )}
                style={{ width: NODE_W, cursor: "grab" }}
              >
                {n.step.type === "exit" ? (
                  <span className="absolute -top-2.5 left-3 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">Só por desvio</span>
                ) : metrics.worstExit?.i === n.i && (
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
                {m && (
                  <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px]">
                    <span className="font-medium text-slate-500">{m.reached} leads</span>
                    {m.reached > 0
                      ? <span className={cn("font-semibold", cor)}>↓ {m.dropPct}% saída</span>
                      : <span className="font-medium text-slate-300">—</span>}
                  </div>
                )}
                <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300" />
                {!n.isChoice && <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300" />}
              </div>

              {/* Bloco de saída abaixo — cabecinhas 3D de quem parou aqui */}
              {stoppedHeads.length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-white/95 px-2 py-1.5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {stoppedHeads.slice(0, 5).map((h, hi) => (
                      <span key={h.id + hi} className="flex items-center gap-1" title={`${h.name} — ${h.completed ? "concluiu" : "saiu aqui"}`}>
                        <Head3D completed={h.completed} />
                        <span className="max-w-[52px] truncate text-[10px] font-medium text-slate-600">{h.name}</span>
                      </span>
                    ))}
                    {stoppedHeads.length > 5 && (
                      <span className="text-[10px] font-semibold text-slate-400">+{stoppedHeads.length - 5}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );})}

          {/* Overlay de animação: bolinhas percorrendo as linhas */}
          <div className="pointer-events-none absolute left-0 top-0 z-10">
            {animBalls.map((b, bi) => (
              <div
                key={"ball" + b.id}
                ref={(el) => { ballEls.current[bi] = el; }}
                className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ opacity: 0, background: b.color, willChange: "transform, opacity" }}
                title={b.name}
              >
                {b.name.slice(0, 1)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Cabecinha 3D (verde = concluiu / vermelho = saiu do fluxo).
function Head3D({ completed }: { completed: boolean }) {
  const c = completed ? { a: "#34d399", b: "#059669" } : { a: "#fb7185", b: "#e11d48" };
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `radial-gradient(circle at 32% 28%, ${c.a}, ${c.b})`,
        boxShadow: `inset 0 1px 1.5px rgba(255,255,255,.55), inset 0 -2px 3px rgba(0,0,0,.28), 0 1.5px 3px rgba(0,0,0,.25)`,
      }}
    >
      <Users className="h-2.5 w-2.5 text-white/95" />
    </span>
  );
}

function StatRow({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: "rose" | "amber" | "sky" | "emerald" }) {
  const dot = accent === "rose" ? "bg-rose-500" : accent === "amber" ? "bg-amber-500" : accent === "sky" ? "bg-sky-500" : accent === "emerald" ? "bg-emerald-500" : "bg-slate-300";
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
      </p>
      <p className="mt-0.5 truncate text-[15px] font-bold leading-tight text-slate-900">{value}</p>
      <p className="truncate text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Gift, RotateCw } from "lucide-react";
import type { FlowStep, WheelSegment } from "@/lib/types";

const ORANGE = "#f59e0b";
const BLUE = "#1d4ed8";

const DEFAULT_SEGMENTS: WheelSegment[] = [
  { label: "Prêmio!" }, { label: "Super desconto!" }, { label: "Cupom desconto!" }, { label: "Super desconto!" },
  { label: "Prêmio!" }, { label: "Cupom desconto!" }, { label: "Brinde grátis!" }, { label: "Super grátis!" },
];

const SIZE = 300;
const DISC = 250;
const LABEL_R = 82;
const BULB_R = 138;
const BULBS = 18;

type Phase = "idle" | "spinning" | "retry" | "win";

export function SpinWheelBlock({ step, onFinish }: { step: FlowStep; onFinish: (prize: string) => void }) {
  const c = step.config;
  const segments = c.wheel_segments && c.wheel_segments.length >= 2 ? c.wheel_segments : DEFAULT_SEGMENTS;
  const spinEnabled = c.spin_enabled ?? true;
  const centerLabel = c.button_label ?? "GIRE!";
  const resultPrefix = c.result_prefix ?? "Você ganhou:";
  const ctaLabel = c.cta_label ?? "Resgatar no WhatsApp";
  const retryLabel = c.retry_label ?? "Girar novamente";
  const maxAttempts = Math.max(1, c.max_attempts ?? 1);
  const outcomes = c.attempt_outcomes ?? [];

  // cores
  const bg = c.wheel_bg ?? "#1e3a8a";
  const ca = c.wheel_color_a ?? ORANGE;
  const cb = c.wheel_color_b ?? BLUE;
  const ring = c.wheel_ring ?? "#d4a017";
  const accent = c.wheel_accent ?? "#ffcf3f";

  const n = segments.length;
  const seg = 360 / n;
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const targetRef = useRef(0);

  const conic = useMemo(() => {
    const stops = segments.map((s, i) => `${s.color ?? (i % 2 === 0 ? ca : cb)} ${i * seg}deg ${(i + 1) * seg}deg`).join(", ");
    return `conic-gradient(from 0deg, ${stops})`;
  }, [segments, seg, ca, cb]);

  const confetti = useMemo(
    () => Array.from({ length: 70 }).map(() => ({
      left: Math.random() * 100,
      size: 6 + Math.random() * 7,
      color: [ca, cb, accent, "#ffffff", "#22c55e"][Math.floor(Math.random() * 5)],
      dur: 2.6 + Math.random() * 2.2,
      delay: Math.random() * 1.4,
      round: Math.random() > 0.5,
    })),
    [ca, cb, accent],
  );

  const pickWeighted = () => {
    const weights = segments.map((s) => s.weight ?? 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < n; i++) { r -= weights[i]; if (r <= 0) return i; }
    return n - 1;
  };
  const outcomeFor = (i: number) => {
    const o = outcomes[i];
    return typeof o === "number" && o >= 0 && o < n ? o : pickWeighted();
  };

  const spin = () => {
    if (phase === "spinning" || phase === "win" || attempt >= maxAttempts) return;
    if (!spinEnabled) { onFinish(segments[0].label); return; }
    const target = outcomeFor(attempt);
    targetRef.current = target;
    const desired = ((360 - (target * seg + seg / 2)) % 360 + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    let delta = desired - currentMod;
    if (delta <= 0) delta += 360;
    setRotation(rotation + 360 * 5 + delta);
    setResult(null);
    setPhase("spinning");
  };

  const onEnd = () => {
    if (phase !== "spinning") return;
    setResult(targetRef.current);
    const done = attempt + 1;
    setAttempt(done);
    setPhase(done >= maxAttempts ? "win" : "retry");
  };

  const remaining = maxAttempts - attempt;

  return (
    <div
      className="relative -mx-5 overflow-hidden rounded-2xl px-5 py-7 text-center text-white"
      style={{ background: `linear-gradient(180deg, ${bg}, color-mix(in srgb, ${bg} 45%, #000))` }}
    >
      {/* confete */}
      {phase === "win" && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {confetti.map((p, i) => (
            <span key={i} className="confetti-piece absolute" style={{
              top: -20, left: `${p.left}%`, width: p.size, height: p.size, background: p.color,
              borderRadius: p.round ? "9999px" : "2px", animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
            }} />
          ))}
        </div>
      )}

      {c.title && <h1 className="text-2xl font-extrabold uppercase tracking-tight drop-shadow" style={{ color: accent }}>{c.title}</h1>}
      {c.subtitle && <p className="mt-1 text-sm text-white/80">{c.subtitle}</p>}
      {maxAttempts > 1 && phase !== "win" && (
        <p className="mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
          Tentativa {Math.min(attempt + 1, maxAttempts)} de {maxAttempts}
        </p>
      )}

      <div className={`relative mx-auto mt-5 ${phase === "win" ? "wheel-win-pop" : ""}`} style={{ width: SIZE, height: SIZE }}>
        {/* aro */}
        <div className="absolute inset-0 rounded-full" style={{ border: `9px solid ${ring}`, boxShadow: `0 0 0 3px color-mix(in srgb, ${ring} 55%, #000), 0 0 26px rgba(255,205,63,.45), inset 0 0 18px rgba(0,0,0,.5)` }} />
        {/* luzes */}
        {Array.from({ length: BULBS }).map((_, i) => (
          <span key={i} className="wheel-bulb absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full" style={{
            transform: `translate(-50%,-50%) rotate(${(i * 360) / BULBS}deg) translateY(-${BULB_R}px)`,
            animationDelay: `${-(i * 1.3) / BULBS}s`,
          }} />
        ))}

        {/* disco */}
        <div onTransitionEnd={onEnd} className="absolute rounded-full" style={{
          width: DISC, height: DISC, left: (SIZE - DISC) / 2, top: (SIZE - DISC) / 2, background: conic,
          transform: `rotate(${rotation}deg)`, transition: phase === "spinning" ? "transform 4.6s cubic-bezier(.16,.84,.14,1)" : "none",
          boxShadow: "inset 0 0 0 3px rgba(0,0,0,.25)",
        }}>
          {segments.map((s, i) => {
            const mid = i * seg + seg / 2;
            const flip = mid > 90 && mid < 270;
            return (
              <div key={i} className="absolute left-1/2 top-1/2 text-center text-[11px] font-extrabold uppercase leading-tight text-white drop-shadow" style={{
                width: 92, transform: `translate(-50%,-50%) rotate(${mid}deg) translateY(-${LABEL_R}px)${flip ? " rotate(180deg)" : ""}`,
              }}>
                {s.label.split(" ").map((w, k) => <span key={k} className="block">{w}</span>)}
              </div>
            );
          })}
        </div>

        {/* fatia vencedora brilhando (no topo, sob o ponteiro) */}
        {phase === "win" && (
          <div className="wheel-wedge pointer-events-none absolute rounded-full" style={{
            width: DISC, height: DISC, left: (SIZE - DISC) / 2, top: (SIZE - DISC) / 2,
            background: `conic-gradient(from ${-seg / 2}deg, rgba(255,255,255,.9) 0deg ${seg}deg, transparent ${seg}deg 360deg)`,
            mixBlendMode: "overlay",
          }} />
        )}

        {/* ponteiro */}
        <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: "16px solid transparent", borderRight: "16px solid transparent", borderTop: `30px solid ${ca}`, filter: "drop-shadow(0 2px 2px rgba(0,0,0,.4))" }} />

        {/* GIRE */}
        <button onClick={spin} disabled={phase === "spinning" || phase === "win"} className="absolute left-1/2 top-1/2 z-10 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 bg-[#0b1220] text-lg font-extrabold shadow-[0_0_18px_rgba(255,205,63,.5)] transition-transform active:scale-95 disabled:opacity-90"
          style={{ borderColor: accent, color: accent }}>
          {phase === "spinning" ? "…" : centerLabel}
        </button>
      </div>

      {/* rodapé por estado */}
      {phase === "win" && result !== null ? (
        <div className="relative z-30 mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">
          <p className="text-sm text-white/70">{resultPrefix}</p>
          <p className="mb-3 flex items-center justify-center gap-2 text-xl font-extrabold" style={{ color: accent }}>
            <Gift className="h-5 w-5" /> {segments[result].label}
          </p>
          <button onClick={() => onFinish(segments[result].label)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-base font-semibold text-white hover:bg-emerald-600">
            {ctaLabel} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : phase === "retry" && result !== null ? (
        <div className="mt-6 rounded-2xl bg-white/10 p-4">
          <p className="text-sm text-white/80">Você caiu em <span className="font-bold" style={{ color: accent }}>{segments[result].label}</span>. {remaining > 0 ? `Ainda tem ${remaining} tentativa(s)!` : ""}</p>
          <button onClick={spin} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold text-[#0b1220]" style={{ background: accent }}>
            <RotateCw className="h-4 w-4" /> {retryLabel}
          </button>
          <button onClick={() => onFinish(segments[result].label)} className="mt-2 w-full text-xs text-white/60 underline">Continuar com esse</button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-white/70">{spinEnabled ? "Toque em GIRE e boa sorte! 🍀" : "Toque em GIRE para continuar."}</p>
      )}
    </div>
  );
}

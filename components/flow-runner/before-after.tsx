"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import type { StepConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

// Antes e depois: modo "deslizar" (sempre abre no antes; ao arrastar e soltar,
// a transição termina sozinha no depois) ou "lado a lado" (estático).

export const BA_ASPECT: Record<NonNullable<StepConfig["ba_aspect"]>, string> = {
  "4:5": "4 / 5",
  "1:1": "1 / 1",
  "3:4": "3 / 4",
  "16:9": "16 / 9",
};

// Enquadramento de cada foto: ponto focal (x/y em %) e zoom.
export function baImgStyle(x = 50, y = 50, zoom = 1): React.CSSProperties {
  return {
    objectPosition: `${x}% ${y}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${x}% ${y}%`,
  };
}

export function beforeAfterFrames(c: StepConfig) {
  return {
    before: baImgStyle(c.ba_before_x, c.ba_before_y, c.ba_before_zoom),
    after: baImgStyle(c.ba_after_x, c.ba_after_y, c.ba_after_zoom),
    aspect: BA_ASPECT[c.ba_aspect ?? "4:5"],
  };
}

export function BeforeAfterView({ c }: { c: StepConfig }) {
  return (c.ba_mode ?? "slider") === "static" ? <StaticPair c={c} /> : <RevealSlider c={c} />;
}

/* ------------------------------ lado a lado ------------------------------ */
function StaticPair({ c }: { c: StepConfig }) {
  const f = beforeAfterFrames(c);
  const items = [
    { url: c.before_url, style: f.before, label: c.ba_before_label || "Antes" },
    { url: c.after_url, style: f.after, label: c.ba_after_label || "Depois" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <figure key={it.label}>
          <div className="relative overflow-hidden rounded-xl bg-slate-100" style={{ aspectRatio: f.aspect }}>
            {it.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.url} alt={it.label} draggable={false} className="absolute inset-0 h-full w-full object-cover" style={it.style} />
            )}
          </div>
          <figcaption className="mt-2 text-center text-xs font-medium text-slate-400">{it.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ------------------------------- deslizar -------------------------------- */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

function RevealSlider({ c }: { c: StepConfig }) {
  const f = beforeAfterFrames(c);
  const fade = c.ba_transition === "fade";
  const rootRef = useRef<HTMLDivElement>(null);
  const pRef = useRef(0); // 0 = antes, 1 = depois
  const anim = useRef<number | null>(null);
  const drag = useRef<{ x: number; p: number; moved: boolean; w: number } | null>(null);
  const beforeImg = useRef<HTMLImageElement>(null);
  const afterImg = useRef<HTMLImageElement>(null);
  const [ok, setOk] = useState({ b: false, a: false });
  const [showingAfter, setShowingAfter] = useState(false);
  const [touched, setTouched] = useState(false);
  const ready = (ok.b && ok.a) || !c.before_url || !c.after_url;

  // Imagem que já veio do cache pode terminar de carregar antes do onLoad
  // existir; confere na montagem e sempre que a URL muda.
  useEffect(() => {
    setOk({
      b: Boolean(beforeImg.current?.complete),
      a: Boolean(afterImg.current?.complete),
    });
  }, [c.before_url, c.after_url]);

  // Pinta o estado direto nas variáveis CSS (sem re-render a cada quadro).
  // `soft` alarga a borda da cortina durante a animação automática.
  const paint = useCallback((p: number, soft = 0) => {
    pRef.current = p;
    const el = rootRef.current;
    if (!el) return;
    const edge = Math.min(1, p / 0.08, (1 - p) / 0.08); // borda some nas pontas
    const feather = (0.03 + 0.06 * soft) * Math.max(0, edge);
    el.style.setProperty("--p", String(p));
    el.style.setProperty("--f", String(feather));
    el.style.setProperty("--lo", String(Math.max(0, Math.min(1, edge * 1.5)) * (1 - soft * 0.6)));
  }, []);

  const stop = () => {
    if (anim.current) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  const animateTo = useCallback((target: number, fromDrag = false) => {
    stop();
    const from = pRef.current;
    const dist = Math.abs(target - from);
    if (dist < 0.001) {
      paint(target);
      setShowingAfter(target > 0.5);
      return;
    }
    const duration = (fromDrag ? 520 : 900) + 650 * dist;
    const ease = fromDrag ? easeOutCubic : easeInOutSine;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const p = from + (target - from) * ease(t);
      paint(p, Math.sin(Math.PI * t)); // borda mais macia no meio do caminho
      if (t < 1) anim.current = requestAnimationFrame(tick);
      else {
        anim.current = null;
        paint(target);
        setShowingAfter(target > 0.5);
      }
    };
    anim.current = requestAnimationFrame(tick);
  }, [paint]);

  useEffect(() => {
    paint(0);
    return stop;
  }, [paint]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, p: pRef.current, moved: false, w: e.currentTarget.getBoundingClientRect().width || 1 };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 4) return;
    d.moved = true;
    if (!touched) setTouched(true);
    paint(clamp01(d.p + dx / d.w));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    setTouched(true);
    if (!d.moved) {
      // Toque: alterna com a transição completa.
      animateTo(pRef.current < 0.5 ? 1 : 0);
      return;
    }
    const delta = pRef.current - d.p;
    const target = delta > 0.02 ? 1 : delta < -0.02 ? 0 : pRef.current < 0.5 ? 0 : 1;
    animateTo(target, true);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") { e.preventDefault(); setTouched(true); animateTo(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); setTouched(true); animateTo(0); }
  };

  const beforeLabel = c.ba_before_label || "Antes";
  const afterLabel = c.ba_after_label || "Depois";
  const mask = "linear-gradient(90deg, #000 calc(var(--p) * 100% - var(--f) * 100%), transparent calc(var(--p) * 100% + var(--f) * 100%))";

  return (
    <div>
      <div
        ref={rootRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={cn(
          "relative select-none overflow-hidden rounded-2xl bg-slate-100 [--f:0] [--lo:0] [--p:0]",
          ready ? "cursor-ew-resize" : "cursor-wait",
        )}
        style={{ aspectRatio: f.aspect, touchAction: "pan-y" }}
      >
        {!ready && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />}

        {/* Antes (base) */}
        {c.before_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={beforeImg} src={c.before_url} alt={beforeLabel} draggable={false} decoding="async"
            onLoad={() => setOk((o) => ({ ...o, b: true }))}
            onError={() => setOk((o) => ({ ...o, b: true }))}
            className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
            style={f.before}
          />
        )}

        {/* Depois (por cima, revelado pela cortina ou pelo dissolver) */}
        {c.after_url && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={fade
              ? { opacity: "var(--p)" as unknown as number }
              : { WebkitMaskImage: mask, maskImage: mask }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={afterImg} src={c.after_url} alt={afterLabel} draggable={false} decoding="async"
              onLoad={() => setOk((o) => ({ ...o, a: true }))}
              onError={() => setOk((o) => ({ ...o, a: true }))}
              className={cn("absolute inset-0 h-full w-full object-cover", !ready && "opacity-0")}
              style={f.after}
            />
          </div>
        )}

        {/* Rótulos */}
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm" style={{ opacity: "calc(1 - var(--p) * 1.6)" as unknown as number }}>{beforeLabel}</span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm" style={{ opacity: "calc(var(--p) * 1.6 - 0.6)" as unknown as number }}>{afterLabel}</span>

        {/* Linha da cortina (some nas pontas e no meio da animação) */}
        {!fade && (
          <div className="pointer-events-none absolute inset-y-0 w-px bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.35)]" style={{ left: "calc(var(--p) * 100%)", opacity: "var(--lo)" as unknown as number }} />
        )}

        {/* Puxador */}
        {ready && (
          <div
            role="slider"
            tabIndex={0}
            aria-label={`Arraste para comparar ${beforeLabel} e ${afterLabel}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={showingAfter ? 100 : 0}
            onKeyDown={onKey}
            className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg ring-1 ring-black/5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            style={{ left: "clamp(30px, calc(var(--p) * 100%), calc(100% - 30px))" }}
          >
            <ChevronsLeftRight className={cn("h-5 w-5", !touched && "animate-[ba-nudge_1.6s_ease-in-out_infinite]")} />
          </div>
        )}

        {/* Dica */}
        {ready && !touched && c.ba_hint !== "" && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            {c.ba_hint || "Arraste para ver o resultado"}
          </span>
        )}
      </div>

      {/* Alternar antes / depois */}
      <div className="mx-auto mt-3 flex w-fit rounded-full bg-slate-100 p-1 text-xs font-semibold">
        {[[beforeLabel, 0], [afterLabel, 1]].map(([label, target]) => {
          const active = (target === 1) === showingAfter;
          return (
            <button
              key={String(target)}
              type="button"
              onClick={() => { setTouched(true); animateTo(target as number); }}
              className={cn("rounded-full px-4 py-1.5 transition-colors", active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import {
  animate, motion, useInView, useMotionValue, useScroll, useSpring,
} from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

// Rolagem suave (Lenis) + barra de progresso de leitura no topo.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    // Links âncora (#planos etc.) rolam suavemente, compensando a navbar fixa.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      const id = a?.getAttribute("href");
      if (!a || !id || id.length < 2) return;
      const el = document.querySelector<HTMLElement>(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -88 });
    };
    document.addEventListener("click", onClick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("click", onClick); lenis.destroy(); };
  }, []);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-600"
    />
  );
}

// Aparece subindo quando entra na tela.
export function Reveal({
  children, delay = 0, y = 28, className, once = true,
}: { children: React.ReactNode; delay?: number; y?: number; className?: string; once?: boolean }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// Pílula de contexto acima dos títulos ("Sem código — Arraste e solte").
export function Eyebrow({ left, right, className }: { left: string; right?: string; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full border border-emerald-200/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur", className)}>
      <span className="whitespace-nowrap font-semibold text-emerald-700">{left}</span>
      {right && <><span className="text-slate-300">—</span><span className="whitespace-nowrap">{right}</span></>}
    </span>
  );
}

// Título de seção com revelação palavra por palavra. O observador fica no
// título inteiro (as palavras começam cortadas pela máscara e não seriam
// detectadas sozinhas) e as palavras entram em cascata.
const WORD = { hidden: { y: "105%" }, show: { y: 0, transition: { duration: 0.75, ease: EASE } } };
export function SplitTitle({ text, className, as = "h2" }: { text: string; className?: string; as?: "h1" | "h2" }) {
  const words = text.split(" ");
  const Comp = as === "h1" ? motion.h1 : motion.h2;
  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
    >
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span className="inline-block" variants={WORD}>
            {w}
            {i < words.length - 1 ? "\u00a0" : ""}
          </motion.span>
        </span>
      ))}
    </Comp>
  );
}

// Número que conta até o valor quando aparece.
export function CountUp({ to, prefix = "", suffix = "", duration = 1.6 }: { to: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration, ease: "easeOut", onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [inView, to, duration]);
  return <span ref={ref}>{prefix}{Math.round(v).toLocaleString("pt-BR")}{suffix}</span>;
}

// Faixa infinita (pausa no hover).
export function Marquee({ children, seconds = 40, reverse = false, className }: { children: React.ReactNode; seconds?: number; reverse?: boolean; className?: string }) {
  return (
    <div className={cn("marquee-pause relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]", className)}>
      <div
        className="animate-marquee flex w-max gap-4"
        style={{ ["--marquee-dur" as string]: `${seconds}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {children}
        {children}
      </div>
    </div>
  );
}

// Botão que "puxa" levemente o cursor (efeito magnético).
export function Magnetic({ children, strength = 0.25, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18 });
  const sy = useSpring(y, { stiffness: 220, damping: 18 });
  return (
    <motion.div
      ref={ref}
      style={{ x: sx, y: sy }}
      className={cn("inline-block", className)}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

// Cartão com brilho que segue o mouse na borda (bento).
export function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || !ref.current) return;
        ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 transition-shadow hover:shadow-xl hover:shadow-emerald-900/5",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(420px circle at var(--mx) var(--my), rgba(16,185,129,.12), transparent 40%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

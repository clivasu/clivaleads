"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Play, Clock, ArrowRight } from "lucide-react";
import type { FlowStep, ShareLinks } from "@/lib/types";

/* ============================ NOTÍCIA / ADVERTORIAL ============================ */

function ShareButtons({ links }: { links?: ShareLinks }) {
  const open = (url?: string) => url && window.open(url, "_blank", "noopener");
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        onClick={() => open(links?.whatsapp)}
        className="flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
          <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.6-.6-2.9-1.3-4.8-4.2-4.9-4.4-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.5.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.8.9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
        </svg>
        Enviar no WhatsApp
      </button>
      <button
        onClick={() => open(links?.facebook)}
        className="flex items-center gap-2 rounded-lg bg-[#1877F2] px-3 py-2 text-sm font-semibold text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
          <path d="M14 9V7c0-.6.4-1 1-1h2V3h-3c-2 0-3 1.5-3 3.5V9H9v3h2v9h3v-9h2.5l.5-3H14Z" />
        </svg>
        Facebook
      </button>
      <button
        onClick={() => open(links?.twitter)}
        className="flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white">
          <path d="M18 2h3l-7 8 8 12h-6l-5-6-5 6H3l7-9L2 2h6l4 5 6-5Zm-2 18h1L8 4H7l9 16Z" />
        </svg>
        Twitter
      </button>
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-slate-600">
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6Z" />
          <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.4 7.6 24 12 24Z" />
          <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3Z" />
          <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.4l3.8 3c.9-2.7 3.4-4.6 6.4-4.6Z" />
        </svg>
        Adicione como fonte no Google
      </div>
    </div>
  );
}

function AudioPlayer() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm text-slate-500">ouvir notícia</p>
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white"
        >
          <Play className="h-4 w-4 fill-white" />
        </button>
        <div className="flex h-8 flex-1 items-center gap-0.5 overflow-hidden">
          {Array.from({ length: 48 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-rose-300"
              style={{ height: `${20 + Math.abs(Math.sin(i * 0.7)) * 70}%` }}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400">{playing ? "0:03" : "0:00"}</span>
        <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">1.0x</span>
      </div>
    </div>
  );
}

function VideoEmbed({ url, title }: { url?: string; title?: string }) {
  if (url) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe src={url} className="h-full w-full" allowFullScreen title={title} />
      </div>
    );
  }
  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-slate-700 to-slate-900">
      <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-red-600">
        <Play className="h-8 w-8 fill-white text-white" />
      </span>
      <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
        Assista no YouTube
      </span>
    </div>
  );
}

export function NewsStep({ step, onNext }: { step: FlowStep; onNext: () => void }) {
  const c = step.config;
  const layout = c.layout ?? "metropoles";

  if (layout === "g1") {
    return (
      <div>
        {c.kicker && (
          <p className="mb-3 text-center text-base font-bold text-slate-900 underline">{c.kicker}</p>
        )}
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center gap-3 bg-[#c4170c] px-4 py-3 text-white">
            <span className="flex flex-col gap-1">
              <span className="h-0.5 w-5 bg-white" />
              <span className="h-0.5 w-5 bg-white" />
              <span className="h-0.5 w-5 bg-white" />
            </span>
            <span className="rounded bg-white px-1.5 text-lg font-black italic text-[#c4170c]">g1</span>
            <span className="text-xl font-extrabold tracking-tight">{c.source ?? "NEGÓCIOS"}</span>
            <svg viewBox="0 0 24 24" className="ml-auto h-5 w-5 fill-white">
              <path d="M10 2a8 8 0 1 0 5 14l5 5 1.5-1.5-5-5A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z" />
            </svg>
          </div>
          <div className="px-4 py-4">
            <h1 className="text-2xl font-extrabold leading-tight text-slate-900">{c.title}</h1>
            {c.byline && <p className="mt-1 text-sm italic text-slate-400">{c.byline}</p>}
            {c.subtitle && <p className="mt-3 font-bold text-slate-900">{c.subtitle}</p>}
            {(c.paragraphs ?? []).map((p, i) => (
              <p key={i} className="mt-2 text-[17px] leading-relaxed text-slate-700">{p}</p>
            ))}
            {(c.news_images?.length ?? 0) > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-1">
                {c.news_images!.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="h-40 w-full object-cover" />
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onNext}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
        >
          {c.button_label ?? "Continuar"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Metrópoles
  return (
    <div className="font-serif">
      {c.kicker && <p className="mb-2 text-sm font-bold text-slate-700">{c.kicker}</p>}
      {c.columnist && (
        <div className="mb-4 flex items-center gap-3">
          {c.columnist.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.columnist.avatar_url} alt={c.columnist.name} className="h-12 w-12 rounded-full object-cover" />
          )}
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {c.columnist.name.split(" ")[0]}{" "}
            <span className="text-amber-500">{c.columnist.name.split(" ").slice(1).join(" ")}</span>
          </span>
        </div>
      )}
      {c.columnist?.name && <p className="mb-1 text-sm font-bold text-rose-600">{c.columnist.name}</p>}
      <h1 className="font-serif text-3xl font-extrabold leading-tight text-slate-900">
        {c.title} {c.highlight_word && <span className="text-rose-600">{c.highlight_word}</span>}
      </h1>
      {c.subtitle && <p className="mt-2 text-lg leading-relaxed text-slate-500">{c.subtitle}</p>}
      <div className="my-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {c.columnist?.name && <span className="font-bold text-rose-600">{c.columnist.name} </span>}
          {c.date}
        </p>
        <span className="flex items-center gap-1 font-sans text-lg font-black tracking-tight text-slate-900">
          <span className="flex h-5 w-5 items-center justify-center bg-slate-900 text-xs text-white">M</span>
          {c.source ?? "ETRÓPOLES"}
        </span>
      </div>
      <ShareButtons links={c.share_links} />
      <VideoEmbed url={c.video_url} title={c.title} />
      {(c.paragraphs ?? []).map((p, i) => (
        <p key={i} className="mt-3 text-[17px] leading-relaxed text-slate-700">{p}</p>
      ))}
      <AudioPlayer />
      <button
        onClick={onNext}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold text-white shadow-sm brand-btn font-sans"
      >
        {c.button_label ?? "Continuar"} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ============================ GRÁFICO CRESCIMENTO ============================ */

export function ChartGrowthStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const you = c.you_series ?? [20, 45, 92];
  const comp = c.competitor_series ?? [25, 30, 34];
  const labels = c.x_labels ?? ["Ontem", "Hoje", "Amanhã"];
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  const W = 320, H = 200, PADX = 20, PADY = 20;
  const maxV = 100;
  const sx = (i: number, n: number) => PADX + (i / (n - 1)) * (W - PADX * 2);
  const sy = (v: number) => PADY + (1 - v / maxV) * (H - PADY * 2);

  const path = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"} ${sx(i, arr.length)} ${sy(v)}`).join(" ");
  const youPath = path(you);
  const area = `${youPath} L ${sx(you.length - 1, you.length)} ${H - PADY} L ${sx(0, you.length)} ${H - PADY} Z`;
  const youEnd = { x: sx(you.length - 1, you.length), y: sy(you[you.length - 1]) };

  return (
    <div ref={ref}>
      {c.title && <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{c.title}</h1>}
      {c.subtitle && <p className="mb-4 text-slate-500">{c.subtitle}</p>}
      <div className="rounded-2xl border bg-white p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {[0, 25, 50, 75, 100].map((g) => (
            <line key={g} x1={PADX} y1={sy(g)} x2={W - PADX} y2={sy(g)} stroke="#f1f5f9" />
          ))}
          <defs>
            <linearGradient id="youArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* competidor */}
          <motion.path
            d={path(comp)}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 6"
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : {}}
            transition={{ duration: 1 }}
          />
          {/* você (área + linha) */}
          <motion.path
            d={area}
            fill="url(#youArea)"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 1, delay: 0.6 }}
          />
          <motion.path
            d={youPath}
            fill="none"
            stroke="#22c55e"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : {}}
            transition={{ duration: 1.2 }}
          />
          <motion.circle
            cx={youEnd.x}
            cy={youEnd.y}
            r="6"
            fill="#22c55e"
            stroke="#fff"
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={inView ? { scale: 1 } : {}}
            transition={{ delay: 1.2 }}
          />
          <motion.g initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 1.3 }}>
            <rect x={youEnd.x - 46} y={youEnd.y - 26} width="42" height="18" rx="9" fill="#22c55e" />
            <text x={youEnd.x - 25} y={youEnd.y - 13} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
              {c.you_label ?? "Você"}
            </text>
          </motion.g>
          {labels.map((l, i) => (
            <text key={l} x={sx(i, labels.length)} y={H - 4} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {l}
            </text>
          ))}
        </svg>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> {c.you_label ?? "Você"}
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> {c.competitor_label ?? "Concorrência"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================ GRÁFICO GAUGE (%) ============================ */

export function ChartGaugeStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const value = Math.max(0, Math.min(100, c.gauge_value ?? 76));
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState(0);

  const R = 80;
  const CIRC = 2 * Math.PI * R;

  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <div ref={ref} className="text-center">
      {c.title && <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{c.title}</h1>}
      {c.subtitle && <p className="mb-4 text-slate-500">{c.subtitle}</p>}
      <div className="relative mx-auto h-56 w-56">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle cx="100" cy="100" r={R} fill="none" stroke="#f1f5f9" strokeWidth="18" />
          <motion.circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="var(--brand, #16a34a)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={inView ? { strokeDashoffset: CIRC - (value / 100) * CIRC } : {}}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-slate-900">{display}%</span>
          {c.gauge_caption && <span className="mt-1 text-sm text-slate-400">{c.gauge_caption}</span>}
        </div>
      </div>
    </div>
  );
}

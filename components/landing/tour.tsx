"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Pause, Play, CircleDot, Gift, TrendingUp, Type, Image as ImageIcon, Copy, Check, Instagram, CheckCheck } from "lucide-react";
import { ClivaMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const CHAPTERS = [
  { title: "Escolha um modelo pronto", sub: "Modelos por procedimento, já com copy e perguntas." },
  { title: "Personalize arrastando blocos", sub: "Perguntas, roleta, gráfico, vídeo. Sem código." },
  { title: "Publique e coloque na bio", sub: "Um link para Instagram, anúncios e WhatsApp." },
  { title: "O paciente chega no WhatsApp", sub: "Com nome, caso e nível de interesse." },
];
const DUR = 5200; // ms por capítulo

export function ProductTour() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [ch, setCh] = useState(0);
  const [p, setP] = useState(0);
  const [playing, setPlaying] = useState(true);
  const state = useRef({ ch: 0, start: 0, base: 0 });

  useEffect(() => {
    if (!inView || !playing) return;
    let raf = 0;
    state.current.start = performance.now();
    state.current.base = p;
    const tick = (now: number) => {
      const v = state.current.base + (now - state.current.start) / DUR;
      if (v >= 1) {
        const next = (state.current.ch + 1) % CHAPTERS.length;
        state.current.ch = next;
        state.current.start = now;
        state.current.base = 0;
        setCh(next);
        setP(0);
      } else setP(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, playing]);

  const jump = (i: number) => {
    state.current.ch = i; state.current.start = performance.now(); state.current.base = 0;
    setCh(i); setP(0); setPlaying(true);
  };

  return (
    <div ref={ref} className="relative">
      <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-emerald-200/40 via-transparent to-teal-200/40 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-slate-950 shadow-[0_50px_100px_-30px_rgba(6,78,59,.5)]">
        {/* barra do navegador */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-rose-400/80" /><span className="h-3 w-3 rounded-full bg-amber-300/80" /><span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <div className="mx-auto flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-xs text-white/60">
            <ClivaMark size={14} /> app.cliva.com.br
          </div>
        </div>

        {/* cena */}
        <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50 sm:aspect-[16/9]">
          {ch === 0 && <SceneModels p={p} />}
          {ch === 1 && <SceneBuilder p={p} />}
          {ch === 2 && <ScenePublish p={p} />}
          {ch === 3 && <SceneWhatsapp p={p} />}
        </div>

        {/* controles do "vídeo" */}
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
          <button onClick={() => setPlaying((v) => !v)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 transition-transform hover:scale-105" aria-label={playing ? "Pausar" : "Reproduzir"}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
          <div className="grid flex-1 grid-cols-4 gap-1.5">
            {CHAPTERS.map((c, i) => (
              <button key={c.title} onClick={() => jump(i)} className="group text-left" aria-label={c.title}>
                <span className="block h-1 overflow-hidden rounded-full bg-white/15">
                  <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${i < ch ? 100 : i === ch ? p * 100 : 0}%` }} />
                </span>
                <span className={cn("mt-1.5 hidden truncate text-[11px] sm:block", i === ch ? "text-white" : "text-white/40 group-hover:text-white/70")}>{c.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <motion.p key={ch} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 text-center text-sm text-slate-500">
        <b className="text-slate-800">{ch + 1}. {CHAPTERS[ch].title}.</b> {CHAPTERS[ch].sub}
      </motion.p>
    </div>
  );
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const seg = (p: number, a: number, b: number) => ease((p - a) / (b - a));

function Cursor({ x, y, down }: { x: number; y: number; down?: boolean }) {
  return (
    <div className="pointer-events-none absolute z-30" style={{ left: `${x}%`, top: `${y}%`, transition: "transform .15s" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" className={cn("drop-shadow-md transition-transform", down && "scale-90")}>
        <path d="M4 2l16 9-7 2-3 7z" fill="#0f172a" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {down && <span className="absolute -left-2 -top-2 h-6 w-6 animate-ping rounded-full bg-emerald-400/50" />}
    </div>
  );
}

function SceneModels({ p }: { p: number }) {
  const models = [
    { t: "Rinomodelação", c: "from-emerald-200 to-teal-200" },
    { t: "Botox Full Face", c: "from-sky-200 to-indigo-200" },
    { t: "Harmonização", c: "from-pink-200 to-rose-200" },
    { t: "Roleta de brinde", c: "from-amber-200 to-orange-200" },
  ];
  const k = seg(p, 0.08, 0.5);
  const picked = p > 0.55;
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-5 sm:px-12">
      <div className="mx-auto w-full max-w-3xl">
      <p className="text-sm font-semibold text-slate-800 sm:text-lg">Escolha um modelo</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-5 sm:grid-cols-4 sm:gap-4">
        {models.map((m, i) => (
          <motion.div key={m.t} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={cn("rounded-2xl border bg-white p-2 shadow-sm transition-all", picked && i === 2 ? "border-emerald-400 ring-4 ring-emerald-100" : "border-slate-200")}>
            <div className={cn("aspect-[4/3] rounded-xl bg-gradient-to-br", m.c)} />
            <p className="mt-2 truncate text-xs font-semibold text-slate-700 sm:text-sm">{m.t}</p>
            {picked && i === 2 && <span className="mt-1 inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">Selecionado</span>}
          </motion.div>
        ))}
      </div>
      </div>
      <div className={cn("absolute bottom-5 right-5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all sm:bottom-8 sm:right-8 sm:text-sm", p > 0.75 ? "scale-95 bg-emerald-700" : "bg-emerald-500")}>
        Usar este modelo
      </div>
      <Cursor x={85 - k * 22 + (p > 0.6 ? seg(p, 0.6, 0.75) * 12 : 0)} y={88 - k * 40 + (p > 0.6 ? seg(p, 0.6, 0.75) * 34 : 0)} down={(p > 0.5 && p < 0.58) || (p > 0.75 && p < 0.83)} />
    </div>
  );
}

function SceneBuilder({ p }: { p: number }) {
  const blocks = [
    { icon: CircleDot, l: "Escolha única" },
    { icon: TrendingUp, l: "Gráfico" },
    { icon: Gift, l: "Roleta" },
    { icon: Type, l: "Texto" },
    { icon: ImageIcon, l: "Antes e depois" },
  ];
  const fly = seg(p, 0.1, 0.45);
  const opts = ["Ponta caída", "Dorso alto", "Nariz desviado"];
  return (
    <div className="absolute inset-0 mx-auto grid max-w-4xl grid-cols-[1fr_1.2fr] items-center gap-4 p-5 sm:grid-cols-[1fr_1.4fr] sm:p-10">
      <div className="space-y-2">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Blocos</p>
        {blocks.map((b, i) => (
          <div key={b.l} className={cn("flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm sm:text-sm", i === 0 && p > 0.08 && p < 0.45 && "opacity-40")}>
            <b.icon className="h-4 w-4 text-emerald-600" /> {b.l}
          </div>
        ))}
      </div>
      <div className="relative flex h-full items-center justify-center self-stretch">
        <div className="h-[88%] w-[62%] max-w-[230px] rounded-[1.4rem] border-4 border-slate-900 bg-white p-3">
          <div className="h-1 rounded-full bg-slate-100"><div className="h-1 rounded-full bg-emerald-500" style={{ width: `${30 + seg(p, 0.5, 0.9) * 40}%` }} /></div>
          <p className="mt-3 text-[11px] font-bold leading-tight text-slate-900 sm:text-sm">O que mais te incomoda no seu nariz?</p>
          <div className="mt-2 space-y-1.5">
            {opts.map((o, i) => (
              <div key={o} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] text-slate-600 sm:text-xs"
                style={{ opacity: seg(p, 0.45 + i * 0.08, 0.6 + i * 0.08), transform: `translateY(${(1 - seg(p, 0.45 + i * 0.08, 0.6 + i * 0.08)) * 8}px)` }}>
                {o}
              </div>
            ))}
          </div>
        </div>
        {p > 0.08 && p < 0.47 && (
          <div className="absolute z-20 flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xl"
            style={{ left: `${-60 + fly * 90}%`, top: `${8 + fly * 30}%` }}>
            <CircleDot className="h-4 w-4 text-emerald-600" /> Escolha única
          </div>
        )}
      </div>
    </div>
  );
}

function ScenePublish({ p }: { p: number }) {
  const copied = p > 0.5;
  return (
    <div className="absolute inset-0 mx-auto grid max-w-4xl grid-cols-1 items-center gap-6 p-5 sm:grid-cols-2 sm:p-10">
      <div>
        <div className={cn("inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all", p < 0.25 ? "animate-pulse bg-emerald-500" : "bg-emerald-700")}>Publicar funil</div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border bg-white p-2 pl-3 shadow-sm" style={{ opacity: seg(p, 0.22, 0.35) }}>
          <span className="flex-1 truncate text-xs font-medium text-slate-700 sm:text-sm">cliva.app/sua-clinica/rino</span>
          <span className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold", copied ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
            {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
          </span>
        </div>
      </div>
      <div className="mx-auto hidden w-[62%] rounded-[1.4rem] border-4 border-slate-900 bg-[#f3efe6] p-3 sm:block" style={{ opacity: seg(p, 0.55, 0.7) }}>
        <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-emerald-300 to-teal-400" />
        <p className="mt-2 text-center text-xs font-bold text-slate-800">Dra. Bárbara</p>
        <p className="flex items-center justify-center gap-1 text-[10px] text-slate-500"><Instagram className="h-3 w-3" /> link na bio</p>
        {["Avaliação de rinomodelação", "Agendar consulta", "Ganhe um brinde"].map((l, i) => (
          <div key={l} className={cn("mt-2 rounded-xl px-2 py-2 text-center text-[10px] font-semibold", i === 0 ? "bg-emerald-600 text-white" : "bg-white text-slate-700")}
            style={{ opacity: seg(p, 0.62 + i * 0.07, 0.75 + i * 0.07) }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function SceneWhatsapp({ p }: { p: number }) {
  const msg = "Olá! Vim pelo Instagram. Tenho interesse em rinomodelação, o que mais me incomoda é a ponta caída e quero fazer ainda este mês. 🙂";
  const typed = msg.slice(0, Math.floor(seg(p, 0.15, 0.7) * msg.length));
  return (
    <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#efeae2] shadow-xl">
        <div className="flex items-center gap-2 bg-[#075e54] px-4 py-2.5 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-300 text-sm font-bold text-emerald-900">B</span>
          <div className="leading-tight"><p className="text-sm font-semibold">Beatriz</p><p className="text-[10px] text-white/70">{p < 0.7 ? "digitando…" : "online"}</p></div>
          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">Lead quente · 91</span>
        </div>
        <div className="min-h-[9rem] space-y-2 p-4">
          {typed && (
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 shadow-sm sm:text-sm">
              {typed}
              {p > 0.7 && <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10px] text-slate-400">14:02 <CheckCheck className="h-3 w-3 text-sky-500" /></span>}
            </div>
          )}
          {p > 0.78 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-xs text-slate-800 shadow-sm sm:text-sm">
              Oi, Beatriz! Vi seu caso aqui. Tenho horário quinta às 15h, posso reservar? 💚
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

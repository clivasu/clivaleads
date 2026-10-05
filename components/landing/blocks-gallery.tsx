"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Reveal } from "@/components/landing/motion";

const loop = (duration: number, extra: object = {}) => ({ duration, repeat: Infinity, ease: "easeInOut" as const, ...extra });

function Choice() {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((v) => (v + 1) % 3), 1300); return () => clearInterval(id); }, []);
  return (
    <div className="w-full space-y-1.5 px-5">
      {["Ponta caída", "Dorso alto", "Nariz desviado"].map((o, k) => (
        <div key={o} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all duration-300 ${k === i ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}>
          <span className={`h-3 w-3 rounded-full border-2 ${k === i ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`} /> {o}
        </div>
      ))}
    </div>
  );
}

function Wheel() {
  const cols = ["#10b981", "#f59e0b", "#0d9488", "#f43f5e", "#34d399", "#6366f1"];
  const slice = (i: number) => {
    const a0 = (i * 60 - 90) * (Math.PI / 180), a1 = ((i + 1) * 60 - 90) * (Math.PI / 180);
    return `M50 50 L${50 + 45 * Math.cos(a0)} ${50 + 45 * Math.sin(a0)} A45 45 0 0 1 ${50 + 45 * Math.cos(a1)} ${50 + 45 * Math.sin(a1)} Z`;
  };
  return (
    <div className="relative h-28 w-28">
      <motion.svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-md"
        animate={{ rotate: [0, 1080 + 200, 1080 + 200] }} transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.7, 1], ease: [0.15, 0.8, 0.25, 1] }}>
        {cols.map((c, i) => <path key={i} d={slice(i)} fill={c} stroke="#fff" strokeWidth="1.5" />)}
        <circle cx="50" cy="50" r="8" fill="#fff" />
      </motion.svg>
      <span className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[12px] border-x-transparent border-t-slate-900" />
    </div>
  );
}

function Curve() {
  return (
    <svg viewBox="0 0 200 110" className="h-28 w-full px-4">
      <defs>
        <linearGradient id="bg-curve" x1="0" x2="1"><stop offset="0" stopColor="#d23c2f" /><stop offset=".5" stopColor="#efcb45" /><stop offset="1" stopColor="#4db6a0" /></linearGradient>
      </defs>
      <motion.path d="M5 100 C 60 98, 80 70, 100 50 S 150 12, 195 8" fill="none" stroke="url(#bg-curve)" strokeWidth="6" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1] }} transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.7, 1] }} />
      <motion.g animate={{ opacity: [0, 0, 1, 1] }} transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.35, 0.4, 1] }}>
        <rect x="52" y="52" width="42" height="16" rx="8" fill="#fff" stroke="#cbd5e1" />
        <text x="73" y="63.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#0f172a">VOCÊ</text>
        <circle cx="73" cy="80" r="5" fill="#fff" stroke="#94a3b8" strokeWidth="2.5" />
      </motion.g>
    </svg>
  );
}

function BeforeAfter() {
  return (
    <div className="relative mx-5 h-28 w-full overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-stone-300 to-stone-400" />
      <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-br from-emerald-200 to-teal-300" animate={{ width: ["30%", "72%", "30%"] }} transition={loop(4)} />
      <motion.div className="absolute inset-y-0 w-0.5 bg-white shadow" animate={{ left: ["30%", "72%", "30%"] }} transition={loop(4)}>
        <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900/70" />
      </motion.div>
      <span className="absolute bottom-1.5 left-2 rounded bg-black/40 px-1.5 text-[9px] font-semibold text-white">Depois</span>
      <span className="absolute bottom-1.5 right-2 rounded bg-black/40 px-1.5 text-[9px] font-semibold text-white">Antes</span>
    </div>
  );
}

function Video() {
  return (
    <div className="relative mx-5 h-28 w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900">
      <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90"><Play className="ml-0.5 h-4 w-4 text-slate-900" /></span>
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
        <motion.div className="h-full bg-emerald-400" animate={{ width: ["0%", "70%", "92%", "100%", "100%"] }} transition={{ duration: 5, repeat: Infinity, times: [0, 0.25, 0.6, 0.85, 1], ease: "linear" }} />
      </div>
    </div>
  );
}

function Timer() {
  const [s, setS] = useState(600);
  useEffect(() => { const id = setInterval(() => setS((v) => (v <= 540 ? 600 : v - 1)), 1000); return () => clearInterval(id); }, []);
  const mm = String(Math.floor(s / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-1.5 font-display">
      {[mm[0], mm[1], ":", ss[0], ss[1]].map((d, i) => d === ":" ? <span key={i} className="text-2xl font-bold text-slate-400">:</span> : (
        <motion.span key={`${i}-${d}`} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex h-12 w-9 items-center justify-center rounded-lg bg-slate-900 text-2xl font-bold text-white">{d}</motion.span>
      ))}
    </div>
  );
}

function Capture() {
  const full = "(61) 99999-0000";
  const [n, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN((v) => (v >= full.length + 8 ? 0 : v + 1)), 140); return () => clearInterval(id); }, []);
  return (
    <div className="w-full space-y-1.5 px-5">
      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700">Juliana</div>
      <div className="rounded-lg border border-emerald-400 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 ring-2 ring-emerald-100">
        {full.slice(0, n)}<span className="animate-pulse text-emerald-600">|</span>
      </div>
      <div className="rounded-lg bg-emerald-500 py-1.5 text-center text-[11px] font-semibold text-white">Ver meu resultado</div>
    </div>
  );
}

function Gauge() {
  return (
    <svg viewBox="0 0 120 70" className="h-24 w-40">
      <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
      <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="url(#gg)" strokeWidth="10" strokeLinecap="round" />
      <defs><linearGradient id="gg"><stop offset="0" stopColor="#f43f5e" /><stop offset=".5" stopColor="#f59e0b" /><stop offset="1" stopColor="#10b981" /></linearGradient></defs>
      <motion.line x1="60" y1="62" x2="60" y2="22" stroke="#0f172a" strokeWidth="3" strokeLinecap="round"
        style={{ originX: "60px", originY: "62px" }} animate={{ rotate: [-80, 55, 40, 55] }} transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }} />
      <circle cx="60" cy="62" r="5" fill="#0f172a" />
    </svg>
  );
}

const CARDS = [
  { title: "Escolha única", desc: "Uma pergunta por tela que engaja e pontua o lead.", el: <Choice /> },
  { title: "Roleta de brinde", desc: "Gamificação que faz o paciente querer falar com você.", el: <Wheel /> },
  { title: "Gráfico de diagnóstico", desc: "Mostra onde a pessoa está e onde pode chegar, ao vivo.", el: <Curve /> },
  { title: "Antes e depois", desc: "Prova visual com comparação deslizante.", el: <BeforeAfter /> },
  { title: "Vídeo com barra inteligente", desc: "Barra que acelera no início e segura até o fim.", el: <Video /> },
  { title: "Timer de oferta", desc: "Urgência real para condições especiais.", el: <Timer /> },
  { title: "Captura de contato", desc: "Nome e WhatsApp no momento certo, com LGPD.", el: <Capture /> },
  { title: "Nível de interesse", desc: "Score que separa quente, potencial e frio.", el: <Gauge /> },
];

export function BlocksGallery() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((c, i) => (
        <Reveal key={c.title} delay={(i % 4) * 0.08}>
          <div className="group h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-900/5">
            <div className="flex h-40 items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50/50">{c.el}</div>
            <div className="p-5">
              <p className="font-display text-base font-semibold text-slate-900">{c.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{c.desc}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

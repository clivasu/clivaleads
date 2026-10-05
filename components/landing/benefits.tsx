"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Activity } from "lucide-react";
import { Eyebrow, Reveal, SplitTitle } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/* ---------- 1. leads chegando já qualificados ---------- */
const LEADS = [
  { n: "Juliana M.", p: "Harmonização facial", d: "Bigode chinês · este mês", s: 87 },
  { n: "Rafael S.", p: "Implante dentário", d: "Perdeu 1 dente · quer orçamento", s: 64 },
  { n: "Camila R.", p: "Bioestimulador", d: "Flacidez · pesquisando", s: 38 },
  { n: "Beatriz L.", p: "Rinomodelação", d: "Ponta caída · ainda este mês", s: 91 },
  { n: "Marina D.", p: "Preenchimento labial", d: "Volume natural · próximos meses", s: 55 },
];
const tier = (s: number) => (s >= 61 ? { l: "Quente", c: "bg-emerald-50 text-emerald-700 ring-emerald-200" } : s >= 31 ? { l: "Potencial", c: "bg-amber-50 text-amber-700 ring-amber-200" } : { l: "Frio", c: "bg-slate-100 text-slate-500 ring-slate-200" });

function LeadStream() {
  const [k, setK] = useState(0);
  useEffect(() => { const id = setInterval(() => setK((v) => v + 1), 2300); return () => clearInterval(id); }, []);
  const list = [0, 1, 2, 3].map((i) => ({ ...LEADS[(k + i) % LEADS.length], key: k + i })).reverse();
  return (
    <div className="space-y-3">
      <AnimatePresence initial={false} mode="popLayout">
        {list.map((l, i) => {
          const t = tier(l.s);
          return (
            <motion.div key={l.key} layout initial={{ opacity: 0, y: -24, scale: 0.97 }} animate={{ opacity: i === 3 ? 0.45 : 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-sm font-bold text-emerald-800">{l.n[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{l.n} <span className="font-normal text-slate-400">· {l.p}</span></p>
                <p className="truncate text-xs text-slate-500">{l.d}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1", t.c)}>{l.s} · {t.l}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ---------- 2. mensagem pronta no WhatsApp ---------- */
function WhatsMessage() {
  const [step, setStep] = useState(0);
  useEffect(() => { const id = setInterval(() => setStep((v) => (v + 1) % 6), 1100); return () => clearInterval(id); }, []);
  const Hl = ({ on, children }: { on: boolean; children: React.ReactNode }) => (
    <span className={cn("rounded px-0.5 transition-colors duration-500", on ? "bg-emerald-200/80 text-emerald-950" : "text-slate-800")}>{children}</span>
  );
  return (
    <div className="overflow-hidden rounded-3xl bg-[#efeae2] shadow-xl shadow-emerald-950/10">
      <div className="flex items-center gap-2.5 bg-[#075e54] px-4 py-3 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-300 font-bold text-emerald-900">J</span>
        <div className="leading-tight"><p className="text-sm font-semibold">Juliana · novo paciente</p><p className="text-[11px] text-white/70">via funil Harmonização</p></div>
      </div>
      <div className="space-y-2 p-4">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
          Olá! Vim pelo Instagram e tenho interesse em <Hl on={step >= 1}>harmonização facial</Hl>. O que mais me incomoda é o <Hl on={step >= 2}>bigode chinês</Hl> e quero fazer <Hl on={step >= 3}>ainda este mês</Hl>. Meu nome é <Hl on={step >= 4}>Juliana</Hl>.
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["Procedimento", "Queixa", "Prazo", "Nome"].map((t, i) => (
            <span key={t} className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all duration-500", step >= i + 1 ? "bg-emerald-600 text-white" : "bg-white/70 text-slate-400")}>
              <Check className="h-3 w-3" /> {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- 3. funil ao vivo (pessoas passando entre etapas) ---------- */
function LiveFunnel() {
  const nodes = [
    { l: "Início", n: 128 }, { l: "Pergunta", n: 104 }, { l: "Diagnóstico", n: 86 }, { l: "WhatsApp", n: 71 },
  ];
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ec4899"];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm [background-image:repeating-linear-gradient(90deg,rgba(59,70,196,.05)_0,rgba(59,70,196,.05)_1px,transparent_1px,transparent_28px),repeating-linear-gradient(0deg,rgba(59,70,196,.05)_0,rgba(59,70,196,.05)_1px,transparent_1px,transparent_28px)]">
      <div className="relative grid grid-cols-4 gap-3">
        <div className="absolute left-[12%] right-[12%] top-[22px] border-t-2 border-dashed border-slate-300" />
        {colors.map((c, i) => (
          <motion.span key={c} className="absolute top-[15px] h-4 w-4 rounded-full shadow" style={{ background: c, boxShadow: `0 0 0 4px ${c}33` }}
            animate={{ left: ["10%", "36%", "62%", "86%"], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 4, repeat: Infinity, delay: i * 1, ease: "easeInOut" }} />
        ))}
        {nodes.map((n, i) => (
          <div key={n.l} className="relative z-10 flex flex-col items-center text-center">
            <motion.span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 bg-white text-xs font-bold text-slate-700"
              animate={{ borderColor: ["#e2e8f0", colors[i], "#e2e8f0"] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.9 }}>
              {i + 1}
            </motion.span>
            <p className="mt-2 text-xs font-semibold text-slate-700">{n.l}</p>
            <p className="text-[11px] text-slate-400">{n.n} pessoas</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
        <p className="text-xs font-medium text-rose-700">Maior saída: <b>Pergunta 2</b> · 19%</p>
        <span className="flex items-center gap-1 text-xs font-semibold text-rose-700"><Activity className="h-3.5 w-3.5" /> ao vivo</span>
      </div>
    </div>
  );
}

const ROWS = [
  {
    eyebrow: ["Leads qualificados", "pontuação automática"],
    title: "Saiba quem está pronto antes do primeiro “oi”",
    text: "Cada resposta vira pontos. O Cliva separa quem é quente, quem tem potencial e quem só está pesquisando, com o diagnóstico de cada caso.",
    bullets: ["Score de 0 a 100 por lead", "Diagnóstico com as dores de cada pessoa", "Filtro por procedimento e origem"],
    visual: <LeadStream />,
  },
  {
    eyebrow: ["Atendimento mais rápido", "WhatsApp com contexto"],
    title: "O paciente chega no WhatsApp com tudo explicado",
    text: "No fim do funil, a mensagem é montada sozinha com as respostas. Sua equipe não precisa perguntar de novo: é só oferecer o horário.",
    bullets: ["Mensagem pronta com nome, queixa e prazo", "Botão com o ícone oficial do WhatsApp", "Funciona com qualquer número"],
    visual: <WhatsMessage />,
  },
  {
    eyebrow: ["Engajamento", "rastreio por etapa"],
    title: "Veja cada pessoa andando pelo seu funil",
    text: "Acompanhe ao vivo onde as pessoas avançam e onde desistem. Ajuste a etapa com maior saída e veja a conversão subir.",
    bullets: ["Simulação da jornada real de cada lead", "Maior saída destacada automaticamente", "Painel de desempenho por funil"],
    visual: <LiveFunnel />,
  },
];

export function Benefits() {
  return (
    <div className="space-y-24 md:space-y-32">
      {ROWS.map((r, i) => (
        <div key={r.title} className={cn("grid items-center gap-10 md:grid-cols-2 md:gap-16 [&>*]:min-w-0", i % 2 === 1 && "md:[&>*:first-child]:order-2")}>
          <div>
            <Reveal><Eyebrow left={r.eyebrow[0]} right={r.eyebrow[1]} /></Reveal>
            <SplitTitle text={r.title} className="font-display mt-5 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 md:text-[2.6rem]" />
            <Reveal delay={0.1}><p className="mt-5 text-lg leading-relaxed text-slate-600">{r.text}</p></Reveal>
            <Reveal delay={0.18}>
              <ul className="mt-6 space-y-2.5">
                {r.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-slate-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100"><Check className="h-3.5 w-3.5 text-emerald-700" /></span>{b}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-100/70 to-teal-100/40 blur-2xl" />
              <div className="relative">{r.visual}</div>
            </div>
          </Reveal>
        </div>
      ))}
    </div>
  );
}


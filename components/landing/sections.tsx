"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Zap, Link2, CalendarDays, Users, Gift, BarChart3, Activity, PlayCircle, Globe, LayoutTemplate, ImageUp, ShieldCheck, X, ArrowUpRight, Smartphone,
} from "lucide-react";
import { FlowRunner } from "@/components/flow-runner/flow-runner";
import { demoFlows } from "@/lib/demo-data";
import { SPECIALTIES, specialtyFlows } from "@/lib/specialty-templates";
import { Reveal, SpotlightCard } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/* ============================ PARA QUEM ============================ */
const AUDIENCE = [
  { k: "Estética", t: "Clínicas de estética e harmonização", d: "Qualifique quem quer botox, preenchimento ou bioestimulador antes de passar valor.", q: "Qual região mais te incomoda hoje?", o: ["Testa e olhos", "Bigode chinês", "Contorno do rosto"] },
  { k: "Odontologia", t: "Consultórios odontológicos", d: "Separe quem precisa de implante, alinhador ou clareamento e o nível de urgência.", q: "O que você quer resolver no seu sorriso?", o: ["Repor um dente", "Alinhar os dentes", "Deixar mais branco"] },
  { k: "Nutrição", t: "Nutricionistas", d: "Entenda objetivo, rotina e disposição para acompanhamento antes da consulta.", q: "Qual é o seu principal objetivo?", o: ["Emagrecer com saúde", "Ganhar massa", "Melhorar exames"] },
  { k: "Dermatologia", t: "Dermatologistas", d: "Triagem de queixas de pele com fotos de antes e depois e diagnóstico inicial.", q: "Qual destas te incomoda mais?", o: ["Manchas", "Acne e marcas", "Flacidez"] },
  { k: "Fisioterapia", t: "Fisioterapeutas", d: "Saiba a dor, há quanto tempo e o impacto na rotina antes de agendar.", q: "Onde é a sua dor principal?", o: ["Coluna", "Joelho", "Ombro"] },
  { k: "Psicologia", t: "Psicólogos", d: "Acolha com perguntas cuidadosas e direcione para a primeira sessão.", q: "O que te trouxe até aqui?", o: ["Ansiedade", "Relacionamentos", "Autoconhecimento"] },
];

export function Audience() {
  const [i, setI] = useState(0);
  const a = AUDIENCE[i];
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {AUDIENCE.map((x, k) => (
          <button key={x.k} onClick={() => setI(k)} className={cn("relative rounded-full px-4 py-2 text-sm font-semibold transition-colors", k === i ? "text-white" : "text-slate-600 hover:text-slate-900")}>
            {k === i && <motion.span layoutId="aud-pill" className="absolute inset-0 rounded-full bg-slate-900" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className="relative">{x.k}</span>
          </button>
        ))}
      </div>
      <div className="mt-10 grid items-center gap-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1.2fr_.8fr] md:p-12">
        <AnimatePresence mode="wait">
          <motion.div key={a.k} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.35 }}>
            <p className="text-sm font-semibold text-emerald-700">{a.k}</p>
            <h3 className="font-display mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900 md:text-4xl">{a.t}</h3>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{a.d}</p>
            <a href="#modelos" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              Ver modelos prontos <ArrowUpRight className="h-4 w-4" />
            </a>
          </motion.div>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div key={a.k + "p"} initial={{ opacity: 0, y: 20, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45 }}
            className="mx-auto w-full max-w-[260px] rounded-[2rem] bg-slate-900 p-2 shadow-2xl">
            <div className="rounded-[1.6rem] bg-white p-4">
              <div className="h-1 rounded-full bg-slate-100"><div className="h-1 w-1/3 rounded-full bg-emerald-500" /></div>
              <p className="mt-4 text-base font-bold leading-snug text-slate-900">{a.q}</p>
              <div className="mt-3 space-y-2">
                {a.o.map((o, k) => (
                  <motion.div key={o} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + k * 0.08 }}
                    className={cn("rounded-xl border px-3 py-2.5 text-sm font-medium", k === 0 ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600")}>
                    {o}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================ RECURSOS (bento) ============================ */
const FEATURES = [
  { icon: Zap, t: "Funis e quizzes interativos", d: "30+ blocos: escolha, escala, roleta, gráfico, vídeo, antes e depois.", big: true },
  { icon: Users, t: "Leads com diagnóstico", d: "Score, dores e procedimento de cada pessoa. Editar, excluir e chamar no WhatsApp." },
  { icon: Activity, t: "Desempenho dos funis", d: "Visitantes, saídas, conversão e perfil (gênero e idade quando coletados)." },
  { icon: Link2, t: "Link na bio premium", d: "4 designs, foto com ajuste de enquadramento e rastreio de cliques." },
  { icon: CalendarDays, t: "Agenda da clínica", d: "Profissionais, procedimentos, retornos e reagendamento." },
  { icon: Gift, t: "Roleta de brindes", d: "Gamificação com cofre: o prêmio só aparece depois do contato." },
  { icon: PlayCircle, t: "Vídeo com barra inteligente", d: "YouTube, Drive, VTurb, Vimeo ou MP4, sem distrações." },
  { icon: BarChart3, t: "Rastreio ao vivo por etapa", d: "Veja as pessoas andando pelo fluxo e onde cada uma parou." },
  { icon: LayoutTemplate, t: "Modelos prontos", d: "Comece por procedimento, com copy testada." },
  { icon: ImageUp, t: "Suas imagens", d: "Envie fotos até 5 MB direto do celular ou computador." },
  { icon: Globe, t: "Domínio e pixel", d: "Seu domínio, Pixel e UTMs para medir cada anúncio." },
  { icon: ShieldCheck, t: "LGPD e dados seguros", d: "Consentimento e contas isoladas por clínica." },
];

export function Features() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((f, i) => (
        <Reveal key={f.t} delay={(i % 4) * 0.06} className={cn(f.big && "sm:col-span-2 lg:row-span-2")}>
          <SpotlightCard className={cn("h-full", f.big && "bg-gradient-to-br from-emerald-600 to-teal-700 text-white")}>
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", f.big ? "bg-white/15" : "bg-emerald-50")}>
              <f.icon className={cn("h-5 w-5", f.big ? "text-white" : "text-emerald-600")} />
            </span>
            <p className={cn("font-display mt-5 font-semibold tracking-[-0.02em]", f.big ? "text-3xl leading-tight" : "text-lg text-slate-900")}>{f.t}</p>
            <p className={cn("mt-2 leading-relaxed", f.big ? "max-w-sm text-lg text-white/80" : "text-sm text-slate-500")}>{f.d}</p>
            {f.big && (
              <div className="mt-8 grid grid-cols-3 gap-2">
                {["Escolha única", "Roleta", "Gráfico", "Vídeo", "Antes e depois", "Timer"].map((b) => (
                  <span key={b} className="rounded-xl bg-white/10 px-2 py-2 text-center text-xs font-medium text-white/90 ring-1 ring-white/15">{b}</span>
                ))}
              </div>
            )}
          </SpotlightCard>
        </Reveal>
      ))}
    </div>
  );
}

/* ============================ MODELOS (com funil jogável) ============================ */
const MODEL_META: Record<string, { tag: string; grad: string }> = {
  "rinomodelacao-clinica-demo": { tag: "Avaliação", grad: "from-emerald-300 via-teal-300 to-cyan-300" },
  "botox-full-face-clinica-demo": { tag: "Avaliação", grad: "from-sky-300 via-indigo-300 to-violet-300" },
  "harmonizacao-facial-clinica-demo": { tag: "Quiz completo", grad: "from-pink-300 via-rose-300 to-orange-200" },
  "preenchimento-labial-clinica-demo": { tag: "Avaliação", grad: "from-fuchsia-300 via-pink-300 to-rose-300" },
  "roleta-clinica-demo": { tag: "Gamificação", grad: "from-amber-300 via-orange-300 to-rose-300" },
  "advertorial-clinica-demo": { tag: "Advertorial", grad: "from-slate-300 via-zinc-300 to-stone-300" },
};

// Modelos por especialidade primeiro (com foto), depois os de estética.
const MODEL_FLOWS = [...specialtyFlows, ...demoFlows];
const SPECIALTY_TAG: Record<string, string> = Object.fromEntries(SPECIALTIES.map((s) => [`modelo-${s.key}`, s.specialty]));

export function Models() {
  const [open, setOpen] = useState<string | null>(null);
  const flow = MODEL_FLOWS.find((f) => f.slug === open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODEL_FLOWS.map((f, i) => {
          const m = MODEL_META[f.slug] ?? { tag: SPECIALTY_TAG[f.slug] ?? "Modelo", grad: "from-emerald-300 to-teal-300" };
          return (
            <Reveal key={f.id} delay={(i % 3) * 0.08}>
              <button onClick={() => setOpen(f.slug)} className="group block w-full overflow-hidden rounded-3xl border border-slate-200 bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/10">
                <div className={cn("relative h-44 overflow-hidden bg-gradient-to-br", m.grad)}>
                  {f.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.cover_image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                  <div className="absolute inset-x-10 bottom-0 top-8 rounded-t-[1.4rem] border-4 border-b-0 border-slate-900 bg-white p-3 transition-transform duration-500 group-hover:-translate-y-2">
                    <div className="h-1 rounded-full bg-slate-100"><div className="h-1 w-1/2 rounded-full bg-emerald-500" /></div>
                    <div className="mt-3 h-2.5 w-4/5 rounded bg-slate-800" />
                    <div className="mt-1.5 h-2.5 w-3/5 rounded bg-slate-800" />
                    <div className="mt-3 space-y-1.5">
                      {[0, 1].map((k) => <div key={k} className="h-6 rounded-lg border border-slate-200" />)}
                    </div>
                  </div>
                  )}
                  <span className="absolute left-4 top-4 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-bold text-slate-700 backdrop-blur">{m.tag}</span>
                </div>
                <div className="flex items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-display truncate text-base font-semibold text-slate-900">{f.name.replace(" — Clínica Demo", "")}</p>
                    <p className="truncate text-sm text-slate-500">{f.procedure}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <Smartphone className="h-3.5 w-3.5" /> Testar
                  </span>
                </div>
              </button>
            </Reveal>
          );
        })}
      </div>

      <AnimatePresence>
        {flow && (
          <motion.div
            data-lenis-prevent
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative"
            >
              <button onClick={() => setOpen(null)} className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
              <div className="w-[min(360px,90vw)] rounded-[2.6rem] bg-slate-900 p-2.5 shadow-2xl">
                <div className="h-[min(680px,80vh)] overflow-y-auto overflow-x-hidden rounded-[2.1rem] bg-white [&>div]:!min-h-full">
                  <FlowRunner key={flow.slug} flow={flow} preview theme={{ primaryColor: "#10b981" }} />
                </div>
              </div>
              <p className="mt-3 text-center text-sm font-medium text-white/80">Modelo pronto · você edita tudo no construtor</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

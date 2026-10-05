"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { ArrowRight, CircleDot, Gift, TrendingUp, MessageCircle, Mail, MousePointerClick } from "lucide-react";
import { FlowRunner } from "@/components/flow-runner/flow-runner";
import { demoFlows } from "@/lib/demo-data";
import { Eyebrow, Magnetic, Marquee } from "@/components/landing/motion";

const EASE = [0.22, 1, 0.36, 1] as const;
const PROFISSOES = ["Dentistas", "Esteticistas", "Biomédicas", "Dermatologistas", "Nutricionistas", "Fisioterapeutas", "Fonoaudiólogas", "Psicólogas", "Harmonização facial", "Cirurgiões plásticos"];

const CHIPS = [
  { icon: CircleDot, label: "Escolha única", cls: "-left-28 top-16" },
  { icon: TrendingUp, label: "Gráfico de diagnóstico", cls: "-left-44 top-48" },
  { icon: Gift, label: "Roleta de brinde", cls: "-left-32 top-[21rem]" },
  { icon: MessageCircle, label: "WhatsApp", cls: "-right-24 top-28" },
];

// Exemplos de notificação no painel (simulação da interface).
const TOASTS = [
  { name: "Juliana", proc: "Harmonização facial", score: 87, tier: "Quente" },
  { name: "Rafael", proc: "Implante dentário", score: 64, tier: "Quente" },
  { name: "Camila", proc: "Bioestimulador", score: 52, tier: "Potencial" },
  { name: "Beatriz", proc: "Rinomodelação", score: 91, tier: "Quente" },
];

export function Hero() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [t, setT] = useState(0);
  const flow = demoFlows.find((f) => f.slug === "rinomodelacao-clinica-demo") ?? demoFlows[0];

  useEffect(() => {
    const id = setInterval(() => setT((v) => (v + 1) % TOASTS.length), 3600);
    return () => clearInterval(id);
  }, []);

  // brilho que acompanha o cursor no fundo do hero
  const sectionRef = useRef<HTMLElement>(null);
  const mx = useSpring(useMotionValue(600), { stiffness: 80, damping: 20 });
  const my = useSpring(useMotionValue(200), { stiffness: 80, damping: 20 });
  const glow = useMotionTemplate`radial-gradient(520px circle at ${mx}px ${my}px, rgba(52,211,153,.18), transparent 60%)`;

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    try { if (email.trim()) sessionStorage.setItem("cliva_signup_email", email.trim()); } catch { /* noop */ }
    router.push("/login?cadastro=1");
  };

  const toast = TOASTS[t];

  return (
    <section
      ref={sectionRef}
      onMouseMove={(e) => {
        const r = sectionRef.current?.getBoundingClientRect();
        if (!r) return;
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      className="relative overflow-hidden pb-16 pt-10 md:pb-24 md:pt-14"
    >
      {/* fundo: grade + manchas menta + brilho do cursor */}
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(15,118,110,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,118,110,.06)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,#000_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-10 h-[28rem] w-[28rem] rounded-full bg-teal-300/25 blur-3xl" />
      <motion.div className="pointer-events-none absolute inset-0 hidden md:block" style={{ background: glow }} />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)]">
        <div className="min-w-0">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <Eyebrow left="Pré-atendimento inteligente" right="para saúde e estética" />
          </motion.div>

          <h1 className="font-display mt-6 text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.035em] text-slate-900 sm:text-6xl lg:text-[4.6rem]">
            {"Transforme seguidores em".split(" ").map((w, i) => (
              <span key={i} className="inline-block overflow-hidden pb-[0.06em] align-bottom">
                <motion.span className="inline-block" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: EASE }}>
                  {w}&nbsp;
                </motion.span>
              </span>
            ))}
            <motion.span
              className="rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 bg-no-repeat px-2 [background-position:0_85%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
              initial={{ backgroundSize: "0% 78%" }}
              animate={{ backgroundSize: "100% 78%" }}
              transition={{ duration: 1, delay: 0.55, ease: EASE }}
            >
              pacientes agendados
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600"
          >
            O Cliva cria funis interativos que qualificam cada pessoa <b className="font-semibold text-slate-800">antes do WhatsApp</b>.
            Você recebe nome, caso e nível de interesse e conversa só com quem está pronto para agendar.
          </motion.p>

          <motion.form
            onSubmit={start}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.62, ease: EASE }}
            className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
          >
            <label className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100">
              <Mail className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu melhor e-mail"
                className="h-14 w-full bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>
            <Magnetic>
              <button className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 px-6 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-transform active:scale-[0.98] sm:w-auto">
                Testar 7 dias grátis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Magnetic>
          </motion.form>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-3 text-sm text-slate-500">
            Sem código · Publica em minutos · Cancele quando quiser
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-10 max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Feito para quem atende</p>
            <Marquee seconds={32}>
              {PROFISSOES.map((p) => (
                <span key={p} className="whitespace-nowrap rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-slate-600">{p}</span>
              ))}
            </Marquee>
          </motion.div>
        </div>

        {/* celular com funil real */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: EASE }}
          className="relative mx-auto w-full max-w-[330px]"
        >
          {CHIPS.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.18, duration: 0.5, ease: EASE }}
              className={`absolute z-20 hidden md:block ${c.cls}`}
            >
              <div className="animate-floaty flex items-center gap-2 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-xl shadow-emerald-950/10 backdrop-blur" style={{ animationDelay: `${i * 0.7}s` }}>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><c.icon className="h-3.5 w-3.5" /></span>
                {c.label}
              </div>
            </motion.div>
          ))}

          <div className="relative rounded-[2.6rem] bg-slate-900 p-2.5 shadow-[0_40px_90px_-25px_rgba(6,78,59,.55)]">
            <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
            <div
              data-lenis-prevent
              className="h-[600px] overflow-y-auto overflow-x-hidden rounded-[2.1rem] bg-white [&>div]:!min-h-full"
            >
              <FlowRunner flow={flow} preview theme={{ primaryColor: "#10b981" }} />
            </div>
          </div>

          {/* notificação de lead chegando */}
          <div className="absolute -bottom-8 left-1/2 z-30 w-64 -translate-x-1/2 sm:left-auto sm:-right-6 sm:translate-x-0 xl:-right-20">
            <AnimatePresence mode="wait">
              <motion.div
                key={t}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-2xl shadow-emerald-950/15 backdrop-blur"
              >
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    {toast.name[0]}
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">Novo lead · {toast.name}</p>
                    <p className="truncate text-xs text-slate-500">{toast.proc}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${toast.tier === "Quente" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {toast.score}
                  </span>
                </div>
                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <MessageCircle className="h-3 w-3" /> Chegou no WhatsApp com o diagnóstico
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute -left-6 -top-8 z-30 hidden rotate-[-8deg] items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg md:flex">
            <MousePointerClick className="h-3.5 w-3.5 text-emerald-300" /> Experimente: é um funil de verdade
          </div>
        </motion.div>
      </div>
    </section>
  );
}

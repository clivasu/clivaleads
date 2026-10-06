"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, Plus, ArrowRight, Sparkles, Link2, Globe, Code2, Download, Gift, ShieldCheck } from "lucide-react";
import { ClivaLogo, ClivaMark } from "@/components/brand/logo";
import { Magnetic, Reveal } from "@/components/landing/motion";
import { cn } from "@/lib/utils";
import { PLANS, formatPrice, planLimits } from "@/lib/plans";

/* ============================ COMPARAÇÃO ============================ */
export function Comparison() {
  const sem = ["Direct cheio de “quanto custa?”", "Equipe repete as mesmas perguntas", "Não sabe qual anúncio traz paciente", "Lead some depois do preço", "Agenda com buracos"];
  const com = ["Paciente chega com o caso explicado", "Mensagem pronta no WhatsApp", "Origem e conversão de cada funil", "Interesse medido antes do contato", "Mais horários preenchidos"];
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Reveal>
        <div className="h-full rounded-3xl border border-slate-200 bg-white/70 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Sem o Cliva</p>
          <ul className="mt-6 space-y-4">
            {sem.map((s) => (
              <li key={s} className="flex items-center gap-3 text-slate-500"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50"><X className="h-4 w-4 text-rose-500" /></span>{s}</li>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white shadow-xl shadow-emerald-900/20">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <p className="relative flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-emerald-100"><ClivaMark size={20} /> Com o Cliva</p>
          <ul className="relative mt-6 space-y-4">
            {com.map((s) => (
              <li key={s} className="flex items-center gap-3 font-medium"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20"><Check className="h-4 w-4" /></span>{s}</li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}

/* ============================ PLANOS ============================ */
const PLANOS = PLANS.map((p) => ({ ...p, price: formatPrice(p.priceCents), limits: planLimits(p) }));
const COMUM = [
  { icon: Sparkles, l: "30+ blocos interativos" }, { icon: Link2, l: "Link na bio + rastreio" }, { icon: Gift, l: "Roleta e diagnóstico" },
  { icon: Globe, l: "Domínio próprio" }, { icon: Code2, l: "Pixel e UTMs" }, { icon: Download, l: "Exportação de leads" },
];

export function Pricing() {
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
        {PLANOS.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.08} className="h-full">
            <div className={cn("relative h-full rounded-[2rem] p-[1.5px]", p.highlight ? "bg-[conic-gradient(from_var(--a,0deg),#34d399,#0d9488,#a7f3d0,#34d399)] [animation:spin-border_6s_linear_infinite]" : "bg-slate-200")}>
              <div className={cn("flex h-full flex-col rounded-[calc(2rem-1.5px)] p-6", p.highlight ? "bg-slate-950 text-white" : "bg-white")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display whitespace-nowrap text-xl font-semibold">Cliva {p.name}</p>
                  {p.highlight && <span className="whitespace-nowrap rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-emerald-950">POPULAR</span>}
                </div>
                <p className={cn("mt-2 text-sm", p.highlight ? "text-white/60" : "text-slate-500")}>{p.desc}</p>
                <p className="mt-6 flex items-end gap-1">
                  <span className={cn("pb-2 text-lg font-semibold", p.highlight ? "text-white/70" : "text-slate-400")}>R$</span>
                  <span className="font-display text-5xl font-semibold tracking-[-0.04em]">{p.price}</span>
                  <span className={cn("pb-2 text-sm", p.highlight ? "text-white/60" : "text-slate-500")}>/mês</span>
                </p>
                <p className={cn("mt-1 text-xs font-semibold", p.highlight ? "text-emerald-300" : "text-emerald-700")}>7 dias grátis para testar</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {p.limits.map(([l, on]) => (
                    <li key={l} className={cn("flex items-center gap-2.5", !on && (p.highlight ? "text-white/35" : "text-slate-400"))}>
                      {on ? <Check className={cn("h-4 w-4", p.highlight ? "text-emerald-300" : "text-emerald-600")} /> : <X className="h-4 w-4" />} {l}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <Link href={`/login?cadastro=1&plano=${p.key}`}
                    className={cn("flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all",
                      p.highlight ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-emerald-950 hover:brightness-110" : "bg-slate-900 text-white hover:bg-emerald-700")}>
                    Começar teste grátis <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.1}>
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white/70 p-6">
          <p className="text-center text-sm font-semibold text-slate-500">Todos os planos incluem</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
            {COMUM.map((c) => (
              <div key={c.l} className="flex flex-col items-center gap-2 text-center text-sm text-slate-600">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50"><c.icon className="h-5 w-5 text-emerald-600" /></span>{c.l}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ============================ FAQ ============================ */
const FAQS = [
  { q: "Preciso saber programar ou contratar um designer?", a: "Não. Você escolhe um modelo, troca textos e imagens e publica. Tudo é visual, arrastando blocos." },
  { q: "Funciona para a minha área?", a: "Sim. Funciona para estética, odontologia, nutrição, dermatologia, fisioterapia, psicologia e outras especialidades da saúde. Os modelos são adaptáveis para qualquer procedimento." },
  { q: "Como o paciente chega ao meu WhatsApp?", a: "No fim do funil, o Cliva monta uma mensagem com as respostas da pessoa e abre o seu WhatsApp. Você recebe o contato já com nome, queixa e prazo." },
  { q: "Como funcionam os 7 dias grátis?", a: "Você cria a conta, escolhe o plano e cadastra o cartão. Nada é cobrado nos primeiros 7 dias. Se cancelar antes do fim do teste, não paga nada." },
  { q: "Os dados dos pacientes ficam seguros?", a: "Sim. Cada clínica tem a sua conta isolada, e os formulários pedem consentimento conforme a LGPD." },
  { q: "Posso trocar de plano depois?", a: "Pode. Comece no plano que fizer sentido e mude quando a agenda crescer, sem perder nada do que já criou." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">
      {FAQS.map((f, i) => (
        <div key={f.q}>
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
            <span className="font-display text-base font-semibold text-slate-900 md:text-lg">{f.q}</span>
            <motion.span animate={{ rotate: open === i ? 45 : 0 }} className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", open === i ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600")}>
              <Plus className="h-4 w-4" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                <p className="px-6 pb-6 leading-relaxed text-slate-600">{f.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ============================ CTA FINAL + RODAPÉ ============================ */
export function FinalCta() {
  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-6 py-16 text-center text-white md:px-16 md:py-24">
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_70%)]" />
        <motion.div className="relative mx-auto w-fit" animate={{ y: [0, -10, 0], rotate: [0, 3, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <ClivaMark size={76} className="rounded-[22px] shadow-2xl shadow-emerald-950/40 ring-4 ring-white/20" />
        </motion.div>
        <h2 className="font-display relative mx-auto mt-8 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.035em] md:text-6xl">
          Sua próxima paciente está a um link de distância.
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-lg text-white/80">Crie o seu primeiro funil hoje e veja quem chega pronto para agendar.</p>
        <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Magnetic>
            <Link href="/login?cadastro=1" className="group flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-semibold text-emerald-800 shadow-xl transition-transform active:scale-[0.98]">
              Testar 7 dias grátis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Magnetic>
          <a href="#modelos" className="rounded-2xl px-6 py-4 text-base font-semibold text-white ring-1 ring-white/40 transition-colors hover:bg-white/10">Ver os modelos</a>
        </div>
        <p className="relative mt-6 flex items-center justify-center gap-1.5 text-sm text-white/70"><ShieldCheck className="h-4 w-4" /> Sem código · Cancele quando quiser</p>
      </div>
    </Reveal>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200/70 bg-white/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <ClivaLogo size={30} wordmarkClassName="font-display text-xl" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">Funis de pré-atendimento que transformam seguidores em pacientes agendados.</p>
        </div>
        {[
          { t: "Produto", l: [["Como funciona", "#como-funciona"], ["Recursos", "#recursos"], ["Modelos", "#modelos"], ["Planos", "#planos"]] },
          { t: "Conta", l: [["Entrar", "/login"], ["Criar conta", "/login?cadastro=1"]] },
          { t: "Contato", l: [["suporte@cliva.app", "mailto:suporte@cliva.app"], ["Dúvidas frequentes", "#faq"]] },
        ].map((c) => (
          <div key={c.t}>
            <p className="text-sm font-semibold text-slate-900">{c.t}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              {c.l.map(([l, h]) => <li key={l}><a href={h} className="hover:text-emerald-700">{l}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200/70 py-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} Cliva. Todos os direitos reservados.</div>
    </footer>
  );
}

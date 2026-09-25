import Link from "next/link";
import {
  ArrowRight, MessageCircle, Zap, BarChart3, Link2, CalendarDays, Users,
  Gift, Sparkles, Check, X, ShieldCheck, Star, Globe, Code2, Download, Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClivaLogo } from "@/components/brand/logo";

export const metadata = {
  title: "Cliva — Transforme seguidores em pacientes agendados",
  description:
    "Funis interativos de pré-atendimento para profissionais da saúde: médicos, dentistas, esteticistas, enfermeiros, fonoaudiólogos e nutricionistas. Qualifique o paciente antes do WhatsApp.",
};

const PROFISSOES = ["Médicos", "Dentistas", "Esteticistas", "Enfermeiros", "Fonoaudiólogos", "Nutricionistas", "Psicólogos", "Fisioterapeutas"];

const DORES = [
  "Você posta todo dia, mas o direct só tem “quanto custa?” e some.",
  "O WhatsApp vira um atendimento cansativo de gente que não fecha.",
  "O anúncio traz clique, mas não traz o paciente certo.",
];

const STEPS = [
  { n: "1", title: "Monte seu funil em minutos", desc: "Perguntas rápidas, antes e depois, prova social e gamificação. Arrasta, solta e publica, sem código." },
  { n: "2", title: "Coloque o link na sua bio", desc: "Um link só, com a sua cara: 4 designs premium, editável e com rastreio de cliques." },
  { n: "3", title: "Receba pacientes no WhatsApp", desc: "O paciente chega qualificado, já com nome, contato e o que quer resolver. Você só fecha." },
];

const FEATURES = [
  { icon: Zap, title: "Funil interativo", desc: "Uma pergunta por tela que engaja e qualifica. O curioso vira paciente pronto pra agendar." },
  { icon: Link2, title: "Link na bio premium", desc: "4 designs prontos, edição livre e rastreio de cada clique. Seu @ vira uma máquina de agendamento." },
  { icon: CalendarDays, title: "Agenda inteligente", desc: "Organize horários, procedimentos e retornos com uma visão clara do seu dia." },
  { icon: Users, title: "Leads com diagnóstico", desc: "Veja o caso de cada paciente, o nível de intenção e chame no WhatsApp com 1 clique." },
  { icon: Gift, title: "Gamificação com brinde", desc: "Roleta premiada que aumenta a conversão e faz o paciente se sentir especial antes de falar com você." },
  { icon: BarChart3, title: "Analytics + UTMs", desc: "Saiba de onde vem cada paciente e qual anúncio realmente lota a sua agenda." },
];

const PLANOS = [
  {
    name: "Essencial", price: "97", desc: "Para começar a lotar sua agenda com tranquilidade.",
    highlight: false,
    limits: [
      { label: "Até 2 funis", on: true }, { label: "Até 5 mil leads/mês", on: true },
      { label: "Webhook / CRM", on: false }, { label: "Edição em equipe", on: false },
    ],
  },
  {
    name: "Pro", price: "197", desc: "Para quem já tem experiência e quer performance.",
    highlight: true,
    limits: [
      { label: "Até 5 funis", on: true }, { label: "Até 10 mil leads/mês", on: true },
      { label: "Webhook / CRM", on: true }, { label: "Edição em equipe", on: false },
    ],
  },
  {
    name: "Elite", price: "297", desc: "Para escala e quem atende demanda de terceiros.",
    highlight: false,
    limits: [
      { label: "Até 10 funis", on: true }, { label: "Até 25 mil leads/mês", on: true },
      { label: "Webhook / CRM", on: true }, { label: "Edição em equipe", on: true },
    ],
  },
];
const PLANO_COMUM = [
  { icon: Sparkles, label: "Componentes interativos" },
  { icon: Link2, label: "Link na bio + rastreio" },
  { icon: Globe, label: "Domínio próprio" },
  { icon: Code2, label: "Pixel e scripts de rastreio" },
  { icon: Download, label: "Gestão e exportação de leads" },
  { icon: Gift, label: "Roleta e diagnóstico de leads" },
];

const FAQS = [
  { q: "Preciso saber programar ou contratar um designer?", a: "Não. Tudo é visual: você escolhe um modelo, edita os textos e publica. Sai do zero ao ar em minutos." },
  { q: "Funciona para a minha área da saúde?", a: "Sim. O Cliva foi feito para médicos, dentistas, esteticistas, enfermeiros, fonoaudiólogos, nutricionistas, psicólogos e fisioterapeutas. Você adapta a copy para o seu procedimento." },
  { q: "Como o paciente chega até o meu WhatsApp?", a: "Ao fim do funil, o Cliva monta a mensagem automaticamente com as respostas do paciente e abre o seu WhatsApp. Você recebe o contato já contextualizado." },
  { q: "Os dados dos meus pacientes ficam seguros?", a: "Sim. Cada conta é isolada e os dados seguem a LGPD, com consentimento e proteção em todas as etapas." },
  { q: "Posso trocar de plano depois?", a: "Sim. Você começa no plano que quiser e sobe conforme sua agenda cresce, sem retrabalho." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white font-display text-slate-900">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <ClivaLogo size={30} />
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#como-funciona" className="hover:text-slate-900">Como funciona</a>
            <a href="#recursos" className="hover:text-slate-900">Recursos</a>
            <a href="#planos" className="hover:text-slate-900">Planos</a>
            <a href="#faq" className="hover:text-slate-900">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link href="/login"><Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">Começar grátis</Button></Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-50/80 via-white to-white" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" /> Pré-atendimento inteligente para a saúde
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tightish sm:text-[3.4rem]">
              Transforme seguidores e cliques em{" "}
              <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">pacientes agendados</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-500">
              O Cliva cria funis interativos que qualificam o paciente <b className="text-slate-700">antes</b> do WhatsApp.
              Menos curioso, mais agendamento, para médicos, dentistas, esteticistas, enfermeiros e fonoaudiólogos.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login">
                <Button size="lg" className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 sm:w-auto">
                  Criar meu funil grátis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/f/rinomodelacao-clinica-demo" target="_blank">
                <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto">
                  <MessageCircle className="h-4 w-4" /> Ver funil de exemplo
                </Button>
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Sem cartão de crédito · No ar em minutos
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-emerald-100 to-teal-100 blur-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cliva-hero.webp" alt="App Cliva" className="relative w-full rounded-2xl shadow-2xl" />
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-14">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">Feito para quem cuida de pessoas</p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {PROFISSOES.map((p) => (
              <span key={p} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <h2 className="text-3xl font-bold tracking-tightish sm:text-4xl">Reconhece a cena?</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {DORES.map((t, i) => (
              <div key={i} className="rounded-2xl border bg-white p-6 text-left">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                  <X className="h-5 w-5" />
                </span>
                <p className="mt-4 text-slate-600">{t}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-lg text-slate-500">
            O problema não é o seu conteúdo. É o que acontece <b className="text-slate-800">entre o clique e o WhatsApp</b>. É aí que o Cliva entra.
          </p>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tightish sm:text-4xl">Da bio ao agendamento em 3 passos</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">Simples para você. Envolvente para o paciente.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-lg font-bold text-white">{s.n}</span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tightish sm:text-4xl">Tudo para encher a sua agenda</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">Um só lugar para atrair, qualificar e agendar.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tightish sm:text-4xl">Planos que crescem com você</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">Selecione o plano que melhor encaixa na sua agenda. Comece grátis e assine quando quiser escalar.</p>
          </div>
          <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
            {PLANOS.map((p) => (
              <div key={p.name} className={p.highlight
                ? "relative rounded-3xl bg-slate-900 p-8 text-white shadow-2xl ring-1 ring-slate-900"
                : "rounded-3xl border bg-white p-8"}>
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Mais popular</span>
                )}
                <span className={p.highlight ? "flex h-12 w-12 items-center justify-center rounded-xl bg-white/10" : "flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white"}>
                  <Box className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-3xl font-bold tracking-tightish">Cliva {p.name}</h3>
                <p className={p.highlight ? "mt-2 text-sm text-slate-300" : "mt-2 text-sm text-slate-500"}>{p.desc}</p>
                <p className="mt-6 flex items-end gap-1">
                  <span className={p.highlight ? "text-lg font-semibold text-slate-300" : "text-lg font-semibold text-slate-400"}>R$</span>
                  <span className="text-5xl font-bold tracking-tightish">{p.price}</span>
                  <span className={p.highlight ? "mb-1 text-slate-300" : "mb-1 text-slate-400"}>/ mês</span>
                </p>

                <div className="mt-6 flex flex-col gap-2.5 border-t pt-6" style={{ borderColor: p.highlight ? "rgba(255,255,255,.12)" : undefined }}>
                  {p.limits.map((l) => (
                    <span key={l.label} className={`flex items-center gap-2 text-sm ${l.on ? (p.highlight ? "text-white" : "text-slate-800") : (p.highlight ? "text-slate-500" : "text-slate-300")}`}>
                      {l.on ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4" />}
                      <span className={l.on ? "font-medium" : ""}>{l.label}</span>
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-2.5 border-t pt-5" style={{ borderColor: p.highlight ? "rgba(255,255,255,.12)" : undefined }}>
                  {PLANO_COMUM.map((c) => (
                    <span key={c.label} className={`flex items-center gap-2.5 text-sm ${p.highlight ? "text-slate-200" : "text-slate-600"}`}>
                      <c.icon className={`h-4 w-4 ${p.highlight ? "text-emerald-400" : "text-slate-400"}`} /> {c.label}
                    </span>
                  ))}
                </div>

                <Link href="/login" className="mt-7 block">
                  <span className={p.highlight
                    ? "flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-6px_rgba(16,185,129,.6)] transition-colors hover:bg-emerald-600"
                    : "flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"}>
                    Assinar esse plano
                  </span>
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Garantia de 7 dias · Cancele quando quiser · Suporte humano
          </p>
        </div>
      </section>

      {/* MODELOS */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tightish sm:text-4xl">Modelos prontos para o seu nicho</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">Comece de um modelo testado e publique hoje.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "Rinomodelação", d: "Corrija o nariz sem cirurgia, quiz + prova social + WhatsApp.", href: "/f/rinomodelacao-clinica-demo" },
              { t: "Botox Full Face", d: "Rosto descansado e natural, objeções quebradas e agendamento.", href: "/f/botox-full-face-clinica-demo" },
              { t: "Preenchimento Labial", d: "Volume natural, diagnóstico e agendamento sem fricção.", href: "/f/preenchimento-labial-clinica-demo" },
            ].map((m) => (
              <Link key={m.t} href={m.href} target="_blank" className="group rounded-2xl border bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                <span className="flex items-center justify-between">
                  <span className="font-semibold">{m.t}</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-emerald-500" />
                </span>
                <p className="mt-2 text-sm text-slate-500">{m.d}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-3xl font-bold tracking-tightish sm:text-4xl">Dúvidas frequentes</h2>
          <div className="mt-10 flex flex-col gap-3">
            {FAQS.map((f, i) => (
              <details key={i} className="group rounded-xl border bg-white p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-800">
                  {f.q}
                  <ArrowRight className="h-4 w-4 rotate-90 text-slate-400 transition-transform group-open:rotate-[270deg]" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-4xl rounded-3xl bg-slate-900 px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tightish sm:text-4xl">Sua agenda cheia começa com um link</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">Crie seu primeiro funil hoje, coloque na bio e comece a receber pacientes qualificados.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login">
              <Button size="lg" className="gap-2 bg-emerald-500 hover:bg-emerald-600">
                Começar grátis agora <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <span className="flex items-center gap-1.5 text-sm text-slate-400">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Sem cartão · No ar em minutos
            </span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <ClivaLogo size={26} />
          <p className="text-sm text-slate-400">Pré-atendimento inteligente para a saúde.</p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <Link href="/login" className="hover:text-slate-900">Entrar</Link>
            <a href="#planos" className="hover:text-slate-900">Planos</a>
          </div>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1 text-center text-xs text-slate-400">
          <Check className="h-3.5 w-3.5 text-emerald-500" /> © 2026 Cliva. Feito para quem cuida de pessoas.
        </p>
      </footer>
    </div>
  );
}

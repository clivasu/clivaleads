import { SmoothScroll, Reveal, Eyebrow, SplitTitle, CountUp } from "@/components/landing/motion";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { ProductTour } from "@/components/landing/tour";
import { BlocksGallery } from "@/components/landing/blocks-gallery";
import { Benefits } from "@/components/landing/benefits";
import { Audience, Features, Models } from "@/components/landing/sections";
import { Comparison, Pricing, Faq, FinalCta, Footer } from "@/components/landing/closing";

export const metadata = {
  title: "Cliva — Transforme seguidores em pacientes agendados",
  description:
    "Funis interativos de pré-atendimento para clínicas de saúde e estética. Qualifique cada pessoa antes do WhatsApp e receba o paciente com nome, caso e nível de interesse.",
  openGraph: {
    title: "Cliva — Transforme seguidores em pacientes agendados",
    description: "Funis interativos que qualificam o paciente antes do WhatsApp. Teste 7 dias grátis.",
    images: ["/cliva-hero.webp"],
  },
};

function SectionHead({ eyebrow, title, sub, center = true }: { eyebrow: [string, string?]; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <Reveal><Eyebrow left={eyebrow[0]} right={eyebrow[1]} /></Reveal>
      <SplitTitle text={title} className="font-display mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-slate-900 md:text-[3.4rem]" />
      {sub && <Reveal delay={0.12}><p className="mt-5 text-lg leading-relaxed text-slate-600">{sub}</p></Reveal>}
    </div>
  );
}

const STATS = [
  { to: 30, suffix: "+", label: "blocos interativos" },
  { to: 6, suffix: "", label: "modelos prontos" },
  { to: 4, suffix: "", label: "designs de link na bio" },
  { to: 7, suffix: " dias", label: "grátis para testar" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f6faf8] text-slate-900 antialiased selection:bg-emerald-200/70">
      <SmoothScroll />
      <LandingNav />

      <main>
        <Hero />

        {/* números do produto */}
        <section className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-slate-200 bg-slate-200 md:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="bg-white px-6 py-8 text-center">
                  <p className="font-display text-4xl font-semibold tracking-[-0.03em] text-slate-900 md:text-5xl">
                    <CountUp to={s.to} suffix={s.suffix} />
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="como-funciona" className="mx-auto max-w-6xl px-6 pt-28 md:pt-40">
          <SectionHead
            eyebrow={["Veja em ação", "do modelo ao WhatsApp"]}
            title="Seu funil no ar em quatro passos"
            sub="Escolha um modelo, ajuste os blocos, publique o link e receba o paciente qualificado. Sem código e sem depender de ninguém."
          />
          <div className="mt-14"><ProductTour /></div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pt-28 md:pt-40">
          <SectionHead
            eyebrow={["Sem código", "arraste e solte"]}
            title="Blocos que engajam e qualificam"
            sub="Cada bloco foi pensado para a jornada do paciente: prende a atenção, gera confiança e coleta o que a sua equipe precisa saber."
          />
          <div className="mt-14"><BlocksGallery /></div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pt-28 md:pt-40">
          <Benefits />
        </section>

        <section className="mx-auto max-w-6xl px-6 pt-28 md:pt-40">
          <SectionHead
            eyebrow={["Para quem é", "saúde e estética"]}
            title="Feito para quem atende pacientes"
            sub="Perguntas e modelos que falam a língua da sua especialidade."
          />
          <div className="mt-12"><Audience /></div>
        </section>

        <section id="recursos" className="mx-auto max-w-7xl px-6 pt-28 md:pt-40">
          <SectionHead
            eyebrow={["Recursos", "tudo em um só lugar"]}
            title="Tudo o que você precisa para lotar a agenda"
          />
          <div className="mt-14"><Features /></div>
        </section>

        <section id="modelos" className="mx-auto max-w-7xl px-6 pt-28 md:pt-40">
          <SectionHead
            eyebrow={["Modelos prontos", "clique e teste"]}
            title="Comece por um modelo que já funciona"
            sub="Toque em um modelo para jogar o funil de verdade, do jeito que o seu paciente vai ver."
          />
          <div className="mt-14"><Models /></div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pt-28 md:pt-40">
          <SectionHead eyebrow={["Antes e depois", "na sua rotina"]} title="A diferença aparece na agenda" />
          <div className="mt-12"><Comparison /></div>
        </section>

        <section id="planos" className="mx-auto max-w-6xl px-6 pt-28 md:pt-40">
          <SectionHead
            eyebrow={["Planos", "7 dias grátis"]}
            title="Escolha o plano da sua clínica"
            sub="Todos começam com 7 dias grátis. Cancele quando quiser."
          />
          <div className="mt-14"><Pricing /></div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-6 pt-28 md:pt-40">
          <SectionHead eyebrow={["Dúvidas", "respostas rápidas"]} title="Perguntas frequentes" />
          <div className="mt-12"><Faq /></div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pt-28 md:pt-40">
          <FinalCta />
        </section>
      </main>

      <Footer />
    </div>
  );
}

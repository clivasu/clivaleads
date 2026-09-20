import Link from "next/link";
import { ArrowRight, MessageCircle, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoFlows } from "@/lib/demo-data";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight">Prelead</span>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm">Painel</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
          <Zap className="h-3.5 w-3.5" /> Pré-atendimento para clínicas
        </div>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Faça o lead chegar mais preparado no WhatsApp
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
          Transforme cliques de anúncios em conversas contextualizadas com um
          mini-funil visual. Sem formulário longo, sem cadastro do lead.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/f/rinomodelacao-clinica-demo">
            <Button size="lg" className="gap-2">
              Ver funil de exemplo <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">Abrir painel</Button>
          </Link>
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          <Feature icon={<MessageCircle className="h-5 w-5" />} title="WhatsApp dinâmico" desc="Mensagem montada com as respostas do lead." />
          <Feature icon={<Zap className="h-5 w-5" />} title="Uma pergunta por tela" desc="Experiência mobile-first que avança sozinha." />
          <Feature icon={<BarChart3 className="h-5 w-5" />} title="Analytics + UTMs" desc="Veja conclusão, cliques e origem do tráfego." />
        </div>

        <div className="mt-16 rounded-2xl border bg-slate-50 p-6 text-left">
          <p className="mb-4 text-sm font-semibold text-slate-700">Funis de demonstração:</p>
          <div className="flex flex-col gap-2">
            {demoFlows.map((f) => (
              <Link
                key={f.slug}
                href={`/f/${f.slug}`}
                className="flex items-center justify-between rounded-lg bg-white px-4 py-3 text-sm shadow-sm transition hover:shadow-md"
              >
                <span className="font-medium text-slate-800">{f.procedure}</span>
                <span className="text-slate-400">/f/{f.slug}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}

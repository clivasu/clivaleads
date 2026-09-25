import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Mail, Phone, User } from "lucide-react";
import { getLead } from "@/lib/data/leads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tierFromScore, TIER_LABEL } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b py-3 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800">{value ?? "—"}</span>
    </div>
  );
}
const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "");

const TIER_HINT: Record<string, string> = {
  hot: "Lead quente — alta intenção. Priorize o contato agora.",
  warm: "Lead morno — interesse real. Vale um follow-up rápido.",
  cold: "Lead frio — em pesquisa. Nutra com conteúdo e prova social.",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  const tier = tierFromScore(lead.score);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/leads" className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <User className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{lead.name ?? "Lead sem nome"}</h1>
            <p className="text-sm text-slate-500">
              {lead.procedure ?? "—"} · {new Date(lead.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
        <Badge variant={tier}>Score {lead.score} · {TIER_LABEL[tier]}</Badge>
      </header>

      {/* Ações de contato */}
      <div className="mb-4 flex flex-wrap gap-2">
        {lead.phone && (
          <a href={`https://wa.me/${digits(lead.phone)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600">
            <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
          </a>
        )}
        {lead.phone && (
          <a href={`tel:${digits(lead.phone)}`} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Phone className="h-4 w-4" /> {lead.phone}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Mail className="h-4 w-4" /> {lead.email}
          </a>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Diagnóstico</h2>
            <p className="mb-3 text-xs text-slate-500">{TIER_HINT[tier]}</p>
            {lead.answers.length > 0 ? (
              lead.answers.map((a, i) => (
                <Row key={i} label={a.question_title} value={a.answer_label} />
              ))
            ) : (
              <p className="py-3 text-sm text-slate-400">Sem respostas registradas.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Contato & origem</h2>
            <Row label="Nome" value={lead.name} />
            <Row label="Telefone" value={lead.phone} />
            <Row label="E-mail" value={lead.email} />
            <Row label="UTM Source" value={lead.utm_source} />
            <Row label="Campanha" value={lead.utm_campaign} />
            <Row label="Dispositivo" value={lead.device} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

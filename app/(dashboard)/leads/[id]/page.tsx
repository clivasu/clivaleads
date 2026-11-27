import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck2, MessageCircle, Mail, Phone, User } from "lucide-react";
import { getLead, getLeadAppointment } from "@/lib/data/leads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tierFromScore, TIER_LABEL } from "@/lib/scoring";
import { instagramUrl } from "@/lib/funnel-form";
import { answerTitle } from "@/lib/personalize";
import { STATUS_META, type Status } from "@/lib/demo-schedule";
import { normalizeWhatsapp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-3 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800">{value ?? "—"}</span>
    </div>
  );
}
const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "");

// Instagram vira link para o perfil.
function AnswerValue({ title, value }: { title: string; value: string }) {
  const url = /instagram/i.test(title) ? instagramUrl(value) : null;
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{value}</a>
    : <>{value}</>;
}

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
  const [lead, appointment] = await Promise.all([getLead(id), getLeadAppointment(id)]);
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
          <a href={`https://wa.me/${normalizeWhatsapp(lead.phone)}`} target="_blank" rel="noopener noreferrer"
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

      {appointment && (
        <Link href={`/schedule?data=${appointment.date}`} className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100">
          <CalendarCheck2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="min-w-0 text-sm">
            <span className="block font-semibold text-emerald-900">
              {appointment.date.split("-").reverse().join("/")} às {appointment.time} · {STATUS_META[appointment.status as Status]?.label ?? appointment.status}
            </span>
            <span className="block text-emerald-800">{appointment.procedure}{appointment.professional ? ` · ${appointment.professional}` : ""}</span>
          </span>
          <span className="ml-auto shrink-0 text-sm font-medium text-emerald-700">Abrir Agenda</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Diagnóstico</h2>
            <p className="mb-3 text-xs text-slate-500">{TIER_HINT[tier]}</p>
            {lead.answers.length > 0 ? (
              lead.answers.map((a, i) => (a.answer_label.length > 60 || a.answer_label.includes("\n")) ? (
                // Resposta escrita longa: pergunta em cima, texto inteiro embaixo.
                <div key={i} className="border-b py-3 text-sm last:border-0">
                  <p className="text-slate-400">{answerTitle(a.question_title, lead.name)}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words font-medium leading-relaxed text-slate-800">{a.answer_label}</p>
                </div>
              ) : (
                <Row key={i} label={answerTitle(a.question_title, lead.name)} value={<AnswerValue title={a.question_title} value={a.answer_label} />} />
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

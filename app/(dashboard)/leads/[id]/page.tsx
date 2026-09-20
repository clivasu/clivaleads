import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{lead.procedure}</h1>
          <p className="text-sm text-slate-500">
            {new Date(lead.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={tier}>Score {lead.score} · {TIER_LABEL[tier]}</Badge>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Respostas</h2>
            {lead.answers.map((a, i) => (
              <Row key={i} label={a.question_title} value={a.answer_label} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Origem</h2>
            <Row label="UTM Source" value={lead.utm_source} />
            <Row label="UTM Medium" value={lead.utm_medium} />
            <Row label="Campaign" value={lead.utm_campaign} />
            <Row label="Creative" value={lead.utm_content} />
            <Row label="Dispositivo" value={lead.device} />
            <Row label="Clique WhatsApp" value={lead.whatsapp_clicked ? "Sim" : "Não"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

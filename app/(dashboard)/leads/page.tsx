import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { listLeads } from "@/lib/data/leads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tierFromScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  new: "Novo", qualified: "Qualificado", whatsapp: "WhatsApp",
  scheduled: "Agendado", converted: "Convertido", lost: "Perdido",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export default async function LeadsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const leads = await listLeads(org.id);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">{leads.length} sessões capturadas.</p>
      </header>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Procedimento</th>
                  <th className="px-5 py-3 font-medium">Principais respostas</th>
                  <th className="px-5 py-3 text-right font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Origem</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-center font-medium">WA</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const tier = tierFromScore(l.score);
                  return (
                    <tr key={l.id} className="border-b transition-colors last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-500">
                        <Link href={`/leads/${l.id}`} className="block">{fmt(l.created_at)}</Link>
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        <Link href={`/leads/${l.id}`} className="block">{l.procedure}</Link>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {l.answers.slice(0, 2).map((a) => a.answer_label).join(" · ")}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge variant={tier}>{l.score}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{l.utm_source ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline">{STATUS_LABEL[l.status]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-center">{l.whatsapp_clicked ? "✅" : "—"}</td>
                    </tr>
                  );
                })}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                      Nenhum lead ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { getCurrentOrg } from "@/lib/data/org";
import { listLeads } from "@/lib/data/leads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tierFromScore, TIER_LABEL } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function digits(p?: string | null) {
  return (p ?? "").replace(/\D/g, "");
}

export default async function LeadsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const all = await listLeads(org.id);
  // Somente leads que deixaram contato (nome, telefone ou e-mail).
  const leads = all.filter((l) => l.name || l.phone || l.email);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">
          {leads.length} contato{leads.length === 1 ? "" : "s"} capturado{leads.length === 1 ? "" : "s"} · abra para ver o diagnóstico.
        </p>
      </header>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-5 py-3 font-medium">Telefone</th>
                  <th className="px-5 py-3 font-medium">Procedimento</th>
                  <th className="px-5 py-3 font-medium">Diagnóstico</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 text-center font-medium">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const tier = tierFromScore(l.score);
                  return (
                    <tr key={l.id} className="border-b transition-colors last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link href={`/leads/${l.id}`} className="block">
                          <span className="block font-semibold text-slate-900">{l.name ?? "Sem nome"}</span>
                          {l.email && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Mail className="h-3 w-3" /> {l.email}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {l.phone ? (
                          <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" /> {l.phone}</span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        <Link href={`/leads/${l.id}`} className="block">{l.procedure ?? "—"}</Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={tier}>{l.score} · {TIER_LABEL[tier]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{fmt(l.created_at)}</td>
                      <td className="px-5 py-3 text-center">
                        {l.phone ? (
                          <a
                            href={`https://wa.me/${digits(l.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> Chamar
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                      Nenhum lead com contato ainda. Quando alguém preencher nome, e-mail ou telefone no funil, aparece aqui.
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

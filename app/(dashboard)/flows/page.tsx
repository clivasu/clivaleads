import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { DeleteFlowButton } from "@/components/flows/delete-flow-button";
import { getCurrentOrg } from "@/lib/data/org";
import { listFlows } from "@/lib/data/flows";
import { seedTemplateFlows } from "@/lib/actions/flows";
import { getFunnelAnalytics } from "@/lib/data/funnel-analytics";
import { parseFilters } from "@/lib/analytics/filters";
import { FunnelInsights } from "@/components/dashboard/funnel-insights";
import { isSupabaseConfigured } from "@/lib/env";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  let flows = await listFlows(org.id);
  // Conta nova (real) recebe os modelos de funil da Cliva na primeira visita.
  if (isSupabaseConfigured && flows.length === 0) {
    try {
      const n = await seedTemplateFlows(org.id);
      if (n > 0) flows = await listFlows(org.id);
    } catch { /* segue sem modelos se algo falhar */ }
  }

  const h = await headers();
  const host = h.get("host") ?? "cliva.me";

  // Desempenho dos funis nos últimos 30 dias (calculado no banco).
  const funnelData = await getFunnelAnalytics(org.id, parseFilters({}));

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Funis</h1>
          <p className="text-sm text-slate-500">Seus mini-funis de pré-atendimento.</p>
        </div>
        <Link href="/flows/new">
          <Button className="gap-2"><Plus className="h-4 w-4" /> Novo funil</Button>
        </Link>
      </header>

      <div className="grid gap-4">
        {flows.map((f) => (
          <Card key={f.id}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{f.name}</h3>
                  <Badge variant={f.status === "published" ? "hot" : "secondary"}>
                    {f.status === "published" ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {f.procedure && <>{f.procedure} · </>}<span className="font-mono text-xs">{host}/{org.slug}/{f.slug}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {f.status === "published" ? (
                  <Link href={`/${org.slug}/${f.slug}`} target="_blank">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2" disabled title="Publique o funil para abrir o link">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir
                  </Button>
                )}
                <Link href={`/flows/${f.id}/builder`}>
                  <Button variant="secondary" size="sm" className="gap-2">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </Link>
                <DeleteFlowButton flowId={f.id} flowName={f.name} />
              </div>
            </CardContent>
          </Card>
        ))}
        {flows.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-slate-400">
              Nenhum funil ainda. Clique em “Novo funil” para começar.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desempenho dos funis (dados reais) */}
      <div className="mt-10">
        <FunnelInsights data={funnelData} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { getCurrentOrg } from "@/lib/data/org";
import { listFlows } from "@/lib/data/flows";
import { seedTemplateFlows } from "@/lib/actions/flows";
import { getDashboardData } from "@/lib/data/dashboard";
import { getLeadInsights } from "@/lib/data/lead-insights";
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

  // Dados de desempenho dos funis (eventos + leads capturados).
  const funnelData = await getDashboardData(org.id);
  const insights = await getLeadInsights(org.id);

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
                  {f.procedure} · <span className="font-mono text-xs">/f/{f.slug}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/f/${f.slug}`} target="_blank">
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir
                  </Button>
                </Link>
                <Link href={`/flows/${f.id}/builder`}>
                  <Button variant="secondary" size="sm" className="gap-2">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </Link>
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
        <FunnelInsights data={funnelData} insights={insights} />
      </div>
    </div>
  );
}

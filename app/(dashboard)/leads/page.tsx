import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentOrg } from "@/lib/data/org";
import { LEADS_PAGE_SIZE, listLeadsPage } from "@/lib/data/leads";
import { Card, CardContent } from "@/components/ui/card";
import { LeadsTable } from "@/components/leads/leads-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const raw = (await searchParams).pagina;
  const page = Math.max(1, Number.parseInt(Array.isArray(raw) ? raw[0] : raw ?? "1", 10) || 1);
  // Somente leads que deixaram contato (nome, telefone ou e-mail), paginados no banco.
  const { rows: leads, total } = await listLeadsPage(org.id, page);
  const pages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * LEADS_PAGE_SIZE + 1;
  const last = Math.min(total, page * LEADS_PAGE_SIZE);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">
          {total.toLocaleString("pt-BR")} contato{total === 1 ? "" : "s"} capturado{total === 1 ? "" : "s"} · abra para ver o diagnóstico.
        </p>
      </header>

      <Card>
        <CardContent className="p-0">
          <LeadsTable key={page} leads={leads} />
        </CardContent>
      </Card>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm text-slate-500" aria-label="Paginação">
          <span>{first.toLocaleString("pt-BR")}–{last.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}</span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={`/leads?pagina=${page - 1}`} className="flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /> Anterior</Link>
            ) : <span className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-slate-300"><ChevronLeft className="h-4 w-4" /> Anterior</span>}
            <span>Página {page} de {pages}</span>
            {page < pages ? (
              <Link href={`/leads?pagina=${page + 1}`} className="flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50">Próxima <ChevronRight className="h-4 w-4" /></Link>
            ) : <span className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-slate-300">Próxima <ChevronRight className="h-4 w-4" /></span>}
          </div>
        </nav>
      )}
    </div>
  );
}

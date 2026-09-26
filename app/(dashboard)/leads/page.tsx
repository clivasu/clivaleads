import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { listLeads } from "@/lib/data/leads";
import { Card, CardContent } from "@/components/ui/card";
import { LeadsTable, type LeadRow } from "@/components/leads/leads-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const all = await listLeads(org.id);
  // Somente leads que deixaram contato (nome, telefone ou e-mail).
  const leads: LeadRow[] = all
    .filter((l) => l.name || l.phone || l.email)
    .map((l) => ({
      id: l.id, name: l.name, phone: l.phone, email: l.email,
      procedure: l.procedure, score: l.score, status: l.status, created_at: l.created_at,
    }));

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
          <LeadsTable leads={leads} />
        </CardContent>
      </Card>
    </div>
  );
}

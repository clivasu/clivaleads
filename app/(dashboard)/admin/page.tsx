import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/data/org";
import { getAdminOverview } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isSuperAdmin())) redirect("/dashboard");
  const { totals, orgs } = await getAdminOverview();

  const cards = [
    { label: "Contas (clínicas)", value: totals.orgs },
    { label: "Usuários", value: totals.users },
    { label: "Funis", value: totals.flows },
    { label: "Leads", value: totals.leads },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin geral</h1>
        <p className="text-sm text-slate-500">Visão de todas as contas da plataforma.</p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-white p-4">
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Clínica</th>
              <th className="px-4 py-3 font-medium">Identificador</th>
              <th className="px-4 py-3 font-medium">Funis</th>
              <th className="px-4 py-3 font-medium">Leads</th>
              <th className="px-4 py-3 font-medium">Criada em</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{o.name}</td>
                <td className="px-4 py-3">
                  <a href={`/${o.slug}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">/{o.slug}</a>
                </td>
                <td className="px-4 py-3 text-slate-600">{o.flows}</td>
                <td className="px-4 py-3 text-slate-600">{o.leads}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhuma conta ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

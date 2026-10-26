import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { getCurrentOrg } from "@/lib/data/org";
import { isSupabaseConfigured } from "@/lib/env";
import { listPatients, PATIENTS_PAGE } from "@/lib/data/patients";
import { ageFrom, formatCpf, formatPhone } from "@/lib/patients";

export const dynamic = "force-dynamic";

const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function PatientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const page = Math.max(1, Number(Array.isArray(sp.pagina) ? sp.pagina[0] : sp.pagina) || 1);
  const { rows, total } = await listPatients(org.id, q, page);
  const pages = Math.max(1, Math.ceil(total / PATIENTS_PAGE));
  const link = (p: number) => `/patients?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(p) }).toString()}`;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString("pt-BR")} paciente{total === 1 ? "" : "s"} · ficha completa, anamnese e histórico de atendimentos.</p>
        </div>
        <Link href="/patients/new" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
          <Plus className="h-4 w-4" /> Novo paciente
        </Link>
      </header>

      <form className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm" role="search">
        <Search className="h-4 w-4 text-slate-400" />
        <input name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou CPF" className="h-11 flex-1 bg-transparent text-sm focus:outline-none" />
        {q && <Link href="/patients" className="text-xs text-slate-400 hover:text-slate-600">limpar</Link>}
      </form>

      {!isSupabaseConfigured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">Conecte o Supabase para cadastrar pacientes.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Paciente</th><th className="px-5 py-3 font-medium">Telefone</th><th className="px-5 py-3 font-medium">CPF</th>
                <th className="px-5 py-3 font-medium">Atendimentos</th><th className="px-5 py-3 font-medium">Último</th><th className="px-5 py-3 font-medium">Próximo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const age = ageFrom(p.birth_date);
                return (
                  <tr key={p.id} className="border-b transition-colors last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/patients/${p.id}`} className="block">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                          {p.name}
                          {p.alerts.length > 0 && <span title={p.alerts.join(" · ")} className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" /> {p.alerts.length}</span>}
                        </span>
                        {age !== null && <span className="text-xs text-slate-400">{age} anos</span>}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.phone ? formatPhone(p.phone) : "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{p.cpf ? formatCpf(p.cpf) : "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{p.visits}</td>
                    <td className="px-5 py-3 text-slate-500">{p.last_visit ? dt(p.last_visit) : "—"}</td>
                    <td className="px-5 py-3 text-slate-500">{p.next_visit ? <span className="font-medium text-emerald-700">{dt(p.next_visit)}</span> : "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">{q ? "Nenhum paciente encontrado." : "Nenhum paciente ainda. Eles entram ao agendar na Agenda ou pelo botão Novo paciente."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-500" aria-label="Paginação">
          {page > 1 && <Link href={link(page - 1)} className="flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5"><ChevronLeft className="h-4 w-4" /> Anterior</Link>}
          <span>Página {page} de {pages}</span>
          {page < pages && <Link href={link(page + 1)} className="flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5">Próxima <ChevronRight className="h-4 w-4" /></Link>}
        </nav>
      )}
    </div>
  );
}

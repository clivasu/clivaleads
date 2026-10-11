import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import { getScheduleData } from "@/lib/data/schedule";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const org = await getCurrentOrg();
  const initial = org && isSupabaseConfigured ? await getScheduleData(org.id) : undefined;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agenda</h1>
        <p className="text-sm text-slate-500">Agendamentos por profissional.</p>
      </div>
      {/* Banco (0012) quando disponível; senão a agenda antiga no navegador. Demo mostra exemplos. */}
      <ScheduleBoard demo={!isSupabaseConfigured} storageKey={org?.id} initial={initial} />
    </div>
  );
}

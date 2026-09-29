import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agenda</h1>
        <p className="text-sm text-slate-500">Agendamentos por profissional.</p>
      </div>
      {/* Conta real começa com a agenda vazia; modo demo mostra exemplos. */}
      <ScheduleBoard demo={!isSupabaseConfigured} />
    </div>
  );
}

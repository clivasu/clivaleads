import { appointmentStats } from "@/lib/demo-dashboard";

const R = 70;
const CIRC = 2 * Math.PI * R;
const GAP = 8; // espaço entre segmentos (px de circunferência)

export function AppointmentDonut({ empty = false }: { empty?: boolean }) {
  const { total, segments } = empty
    ? { total: 0, segments: appointmentStats.segments.map((s) => ({ ...s, value: 0 })) }
    : appointmentStats;
  let offset = 0;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Consultas</h2>
      <p className="mb-4 text-sm text-slate-400">Distribuição deste mês</p>

      <div className="flex flex-col items-center">
        <div className="relative">
          <svg viewBox="0 0 200 200" className="h-52 w-52 -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="#f1f5f9" strokeWidth="22" />
            {total > 0 && segments.map((seg) => {
              const arc = total > 0 ? (seg.value / total) * CIRC : 0;
              const dash = `${Math.max(arc - GAP, 0)} ${CIRC - Math.max(arc - GAP, 0)}`;
              const el = (
                <circle
                  key={seg.label}
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="22"
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              );
              offset += arc;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-400">Total de consultas</span>
          </div>
        </div>

        <div className="mt-5 flex w-full items-center justify-center gap-5">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
              <span className="text-xs text-slate-500">{seg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

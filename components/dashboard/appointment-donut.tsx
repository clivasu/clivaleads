import type { HomeData } from "@/lib/data/home";

const R = 70;
const CIRC = 2 * Math.PI * R;
const GAP = 8; // espaço entre segmentos (px de circunferência)

export function AppointmentDonut({ data, subtitle = "Este mês" }: { data: HomeData["donut"]; subtitle?: string }) {
  const { total, segments } = data;
  let offset = 0;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Consultas</h2>
      <p className="mb-4 text-sm text-slate-400">{subtitle}</p>

      <div className="flex flex-col items-center">
        <div className="relative">
          <svg viewBox="0 0 200 200" className="h-52 w-52 -rotate-90" role="img" aria-label={`Consultas do mês: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
            <circle cx="100" cy="100" r={R} fill="none" stroke="#f1f5f9" strokeWidth="22" />
            {total > 0 && segments.map((seg) => {
              const arc = (seg.value / total) * CIRC;
              const dash = `${Math.max(arc - GAP, 0)} ${CIRC - Math.max(arc - GAP, 0)}`;
              const el = (
                <circle key={seg.label} cx="100" cy="100" r={R} fill="none" stroke={seg.color} strokeWidth="22"
                  strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={-offset} />
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

        {/* legenda em 3 colunas: cabe no cartão em qualquer largura */}
        <div className="mt-5 grid w-full grid-cols-3 gap-2">
          {segments.map((seg) => (
            <div key={seg.label} className="flex min-w-0 flex-col items-center text-center">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: seg.color }} />
                <span className="truncate">{seg.label}</span>
              </span>
              <b className="text-sm text-slate-800">{seg.value}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

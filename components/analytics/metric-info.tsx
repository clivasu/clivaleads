import { Info } from "lucide-react";
import { METRIC_DEFS, type MetricKey } from "@/lib/analytics/metrics";

// Ícone com a definição da métrica (hover, foco por teclado e leitor de tela).
export function MetricInfo({ metric, align = "left" }: { metric: MetricKey; align?: "left" | "right" }) {
  const d = METRIC_DEFS[metric];
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={`O que é ${d.label}: ${d.def}`} className="rounded-full text-slate-300 outline-none hover:text-slate-500 focus-visible:text-emerald-600">
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-5 z-20 w-60 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-600 opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 ${align === "right" ? "right-0" : "left-0"}`}
      >
        <b className="mb-0.5 block text-slate-900">{d.label}</b>
        {d.def}
      </span>
    </span>
  );
}

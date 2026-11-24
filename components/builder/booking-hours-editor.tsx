"use client";

import { Copy, Plus, X } from "lucide-react";
import type { BookingBlockDay, StepConfig } from "@/lib/types";
import { BLOCK_MAX_RANGES, DEFAULT_BOOKING_SETTINGS, minutesToHHMM, normalizeBlockHours, startMinutes } from "@/lib/booking/slots";
import { cn } from "@/lib/utils";

// Dias da semana e horários oferecidos por ESTE bloco de agendamento.
// Sem isso, o bloco usa o horário da clínica (Configurações → Agendamento online).

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // segunda → domingo
const SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const STEPS = [15, 20, 30, 45, 60, 90, 120];
const timeCls = "h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none";
const DEFAULT_RANGE = { start: "09:00", end: "12:00" };

// Ponto de partida: o horário comercial, com a pausa já separada em dois períodos.
function fromDefault(): BookingBlockDay[] {
  return DEFAULT_BOOKING_SETTINGS.hours.map((h) => ({
    open: h.open,
    ranges: h.break_start && h.break_end ? [{ start: h.start, end: h.break_start }, { start: h.break_end, end: h.end }] : [{ start: h.start, end: h.end }],
  }));
}

export function BookingHoursEditor({ c, duration, onChange }: { c: StepConfig; duration: number; onChange: (p: Partial<StepConfig>) => void }) {
  const custom = Array.isArray(c.booking_hours) && c.booking_hours.length === 7;
  const days = custom ? c.booking_hours! : [];
  const step = STEPS.includes(Number(c.booking_slot_minutes)) ? Number(c.booking_slot_minutes) : DEFAULT_BOOKING_SETTINGS.slot_minutes;
  const clean = normalizeBlockHours(c.booking_hours);
  const set = (next: BookingBlockDay[]) => onChange({ booking_hours: next });
  const setDay = (i: number, d: BookingBlockDay) => set(days.map((x, k) => (k === i ? d : x)));
  const toggle = (i: number) => setDay(i, { open: !days[i].open, ranges: days[i].ranges.length ? days[i].ranges : [DEFAULT_RANGE] });
  const copyToOpen = (i: number) => set(days.map((d, k) => (k !== i && d.open ? { ...d, ranges: days[i].ranges.map((r) => ({ ...r })) } : d)));

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-800">Dias e horários disponíveis</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {([[false, "Da clínica"], [true, "Só deste bloco"]] as const).map(([v, label]) => (
          <button key={label} type="button" aria-pressed={custom === v}
            onClick={() => { if (custom !== v) onChange(v ? { booking_hours: fromDefault() } : { booking_hours: undefined, booking_slot_minutes: undefined }); }}
            className={cn("rounded-lg border py-1.5 text-xs font-medium", custom === v ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}>
            {label}
          </button>
        ))}
      </div>

      {!custom ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Usa o horário de Configurações → Agendamento online.</p>
      ) : (
        <>
          <p className="mb-1.5 mt-3 text-xs font-medium text-slate-500">Dias da semana</p>
          <div className="grid grid-cols-7 gap-1">
            {ORDER.map((i) => (
              <button key={i} type="button" aria-pressed={days[i].open} aria-label={LONG[i]} onClick={() => toggle(i)}
                className={cn("rounded-lg border py-2 text-[11px] font-semibold", days[i].open ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-slate-400 hover:border-slate-300")}>
                {SHORT[i]}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3">
            {ORDER.filter((i) => days[i].open).map((i) => {
              const starts = clean?.[i].open ? startMinutes({ open: true, start: "", end: "", ranges: clean[i].ranges }, duration, step).map(minutesToHHMM) : [];
              return (
                <div key={i} className="rounded-lg bg-slate-50 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">{LONG[i]}</p>
                    <button type="button" onClick={() => copyToOpen(i)} title="Copiar estes horários para os outros dias marcados"
                      className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700"><Copy className="h-3 w-3" /> Copiar p/ outros</button>
                  </div>
                  <div className="space-y-1.5">
                    {days[i].ranges.map((r, k) => {
                      const bad = !(r.start && r.end && r.end > r.start);
                      const setRange = (patch: Partial<typeof r>) => setDay(i, { ...days[i], ranges: days[i].ranges.map((x, n) => (n === k ? { ...x, ...patch } : x)) });
                      return (
                        <div key={k}>
                          <div className="flex items-center gap-1">
                            <input type="time" className={timeCls} value={r.start} onChange={(e) => setRange({ start: e.target.value })} aria-label={`${LONG[i]}: início do período ${k + 1}`} />
                            <span className="text-[11px] text-slate-400">às</span>
                            <input type="time" className={timeCls} value={r.end} onChange={(e) => setRange({ end: e.target.value })} aria-label={`${LONG[i]}: fim do período ${k + 1}`} />
                            <button type="button" aria-label={`Remover período ${k + 1} de ${LONG[i]}`} onClick={() => {
                              const ranges = days[i].ranges.filter((_, n) => n !== k);
                              setDay(i, { open: ranges.length > 0, ranges });
                            }} className="rounded p-1 text-slate-400 hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
                          </div>
                          {bad && <p className="mt-0.5 text-[11px] text-amber-700">O fim precisa ser depois do início.</p>}
                        </div>
                      );
                    })}
                  </div>
                  {days[i].ranges.length < BLOCK_MAX_RANGES && (
                    <button type="button" onClick={() => {
                      const last = days[i].ranges.at(-1);
                      const h = last?.end ? Math.min(22, Number(last.end.slice(0, 2)) + 1) : 14;
                      const p = (n: number) => `${String(n).padStart(2, "0")}:00`;
                      setDay(i, { ...days[i], ranges: [...days[i].ranges, { start: p(h), end: p(Math.min(23, h + 2)) }] });
                    }} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700"><Plus className="h-3 w-3" /> Outro período</button>
                  )}
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    {starts.length ? <>A pessoa verá: {starts.slice(0, 8).join(", ")}{starts.length > 8 ? ` e mais ${starts.length - 8}` : ""}</> : <span className="text-amber-700">Nenhum horário cabe: o atendimento dura {duration} min.</span>}
                  </p>
                </div>
              );
            })}
            {!days.some((d) => d.open) && <p className="text-[11px] text-amber-700">Marque ao menos um dia, senão ninguém consegue agendar.</p>}
          </div>

          <label className="mt-3 block text-xs font-medium text-slate-500">Oferecer horários a cada
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700" value={step} onChange={(e) => onChange({ booking_slot_minutes: Number(e.target.value) })}>
              {STEPS.map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Feriados, datas bloqueadas e antecedência mínima continuam os da clínica. Horários já ocupados na Agenda não aparecem.</p>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2, X } from "lucide-react";
import type { BookingBlockDate, BookingBlockDay, StepConfig } from "@/lib/types";
import { addDays, BLOCK_MAX_RANGES, blockMode, brToday, DEFAULT_BOOKING_SETTINGS, minutesToHHMM, normalizeBlockDates, normalizeBlockHours, startMinutes } from "@/lib/booking/slots";
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
  const mode = blockMode(c);
  const custom = mode === "week" && Array.isArray(c.booking_hours) && c.booking_hours.length === 7;
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
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {([["clinic", "Da clínica"], ["week", "Semana fixa"], ["dates", "Datas do mês"]] as const).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={mode === v}
            onClick={() => {
              if (mode === v) return;
              if (v === "clinic") onChange({ booking_mode: "clinic", booking_slot_minutes: undefined, booking_view: undefined });
              else if (v === "week") onChange({ booking_mode: "week", booking_view: undefined, ...(normalizeBlockHours(c.booking_hours) ? {} : { booking_hours: fromDefault() }) });
              else onChange({ booking_mode: "dates", booking_view: "month" });
            }}
            className={cn("rounded-lg border px-1 py-1.5 text-[11px] font-medium", mode === v ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}>
            {label}
          </button>
        ))}
      </div>

      {mode === "clinic" ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Usa o horário de Configurações → Agendamento online.</p>
      ) : mode === "dates" ? (
        <DatesEditor c={c} duration={duration} step={step} onChange={onChange} />
      ) : !custom ? null : (
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

          <div className="mt-3"><ViewAndStep c={c} step={step} onChange={onChange} /></div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Feriados, datas bloqueadas e antecedência mínima continuam os da clínica. Horários já ocupados na Agenda não aparecem.</p>
        </>
      )}
    </div>
  );
}

const WD_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const shiftMonth = (d: string, n: number) => { const [y, m] = d.split("-").map(Number); const t = (y * 12 + m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`; };
const daysIn = (first: string) => Math.round((Date.parse(`${shiftMonth(first, 1)}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000);
const wdOf = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
type Range = { start: string; end: string };

// Datas do mês: marca as datas no calendário e define os horários de cada uma.
function DatesEditor({ c, duration, step, onChange }: { c: StepConfig; duration: number; step: number; onChange: (p: Partial<StepConfig>) => void }) {
  const today = brToday(new Date());
  const dates: BookingBlockDate[] = Array.isArray(c.booking_dates) ? c.booking_dates : [];
  const byDate = new Map(dates.map((d) => [d.date, d]));
  const firstFuture = dates.find((d) => d.date >= today)?.date;
  const [month, setMonth] = useState(() => monthStart(firstFuture ?? today));
  const [active, setActive] = useState<string | null>(firstFuture ?? null);
  const save = (next: BookingBlockDate[]) => onChange({ booking_dates: [...next].sort((a, b) => (a.date < b.date ? -1 : 1)) });
  const template = (): Range[] => (active && byDate.get(active)?.ranges.length ? byDate.get(active)!.ranges : [{ start: "18:00", end: "21:00" }]).map((r) => ({ ...r }));
  const monthDays = Array.from({ length: daysIn(month) }, (_, i) => addDays(month, i));
  const pick = (ds: string) => {
    if (!byDate.has(ds)) save([...dates, { date: ds, ranges: template() }]);
    setActive(ds);
  };
  // Marca (ou desmarca) todas as datas futuras deste dia da semana no mês.
  const toggleWeekday = (wd: number) => {
    const target = monthDays.filter((d) => wdOf(d) === wd && d >= today);
    if (!target.length) return;
    const all = target.every((d) => byDate.has(d));
    if (all) { save(dates.filter((d) => !target.includes(d.date))); if (active && target.includes(active)) setActive(null); }
    else { const tpl = template(); save([...dates, ...target.filter((d) => !byDate.has(d)).map((date) => ({ date, ranges: tpl.map((r) => ({ ...r })) }))]); }
  };
  const cur = active ? byDate.get(active) : undefined;
  const setRanges = (ranges: Range[]) => cur && save(dates.map((d) => (d.date === cur.date ? { ...d, ranges } : d)));
  const inMonth = dates.filter((d) => d.date.startsWith(month.slice(0, 7)));
  const clean = cur ? normalizeBlockDates([cur])[0] : undefined;
  const starts = clean ? startMinutes({ open: true, start: "", end: "", ranges: clean.ranges }, duration, step).map(minutesToHHMM) : [];
  const upcoming = normalizeBlockDates(dates).filter((d) => d.date >= today);

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-slate-200 p-2">
        <div className="mb-1 flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" disabled={month <= monthStart(today)} onClick={() => setMonth(shiftMonth(month, -1))} className="rounded p-1 text-slate-500 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <p className="text-xs font-semibold text-slate-700">{MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}</p>
          <button type="button" aria-label="Próximo mês" disabled={month >= shiftMonth(monthStart(today), 5)} onClick={() => setMonth(shiftMonth(month, 1))} className="rounded p-1 text-slate-500 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WD_NAMES.map((w, i) => (
            <button key={w} type="button" onClick={() => toggleWeekday(i)} title={`Marcar todas as ${w.toLowerCase()} do mês`}
              className="rounded py-1 text-[10px] font-semibold text-slate-400 hover:bg-emerald-50 hover:text-emerald-700">{w}</button>
          ))}
          {Array.from({ length: wdOf(month) }, (_, i) => <span key={`b${i}`} />)}
          {monthDays.map((ds) => {
            const on = byDate.has(ds), past = ds < today, isActive = ds === active;
            return (
              <button key={ds} type="button" disabled={past} onClick={() => pick(ds)} aria-pressed={on} aria-label={`Dia ${br(ds)}`}
                className={cn("h-8 rounded-md text-xs font-medium", past ? "text-slate-200" : on ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-slate-100", isActive && "ring-2 ring-emerald-700 ring-offset-1")}>
                {Number(ds.slice(8, 10))}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">Toque nos dias para abrir. Toque no nome do dia (Seg, Ter…) para marcar todos do mês.</p>
      </div>

      {cur ? (
        <div className="rounded-lg bg-slate-50 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">{WD_NAMES[wdOf(cur.date)]}, {br(cur.date)}</p>
            <button type="button" onClick={() => { save(dates.filter((d) => d.date !== cur.date)); setActive(null); }} className="flex items-center gap-1 text-[11px] font-medium text-rose-600"><Trash2 className="h-3 w-3" /> Remover data</button>
          </div>
          <RangesEditor ranges={cur.ranges} onChange={setRanges} label={br(cur.date)} />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            {starts.length ? <>A pessoa verá: {starts.slice(0, 10).join(", ")}{starts.length > 10 ? ` e mais ${starts.length - 10}` : ""}</> : <span className="text-amber-700">Nenhum horário cabe: o atendimento dura {duration} min.</span>}
          </p>
          {inMonth.length > 1 && (
            <button type="button" onClick={() => save(dates.map((d) => (d.date.startsWith(month.slice(0, 7)) && d.date !== cur.date ? { ...d, ranges: cur.ranges.map((r) => ({ ...r })) } : d)))}
              className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700"><Copy className="h-3 w-3" /> Usar estes horários em todas as datas de {MONTHS[Number(month.slice(5, 7)) - 1].toLowerCase()}</button>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Escolha uma data no calendário para definir os horários.</p>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        {upcoming.length ? <><b className="text-slate-700">{upcoming.length} data{upcoming.length > 1 ? "s" : ""} aberta{upcoming.length > 1 ? "s" : ""}:</b> {upcoming.slice(0, 12).map((d) => br(d.date)).join(", ")}{upcoming.length > 12 ? "…" : ""}</> : <span className="text-amber-700">Nenhuma data aberta: ninguém consegue agendar.</span>}
      </p>
      <ViewAndStep c={c} step={step} onChange={onChange} />
      <p className="text-[11px] leading-relaxed text-slate-500">Só as datas marcadas abrem, mesmo em feriado. Datas bloqueadas e antecedência mínima continuam as da clínica. Horários já ocupados na Agenda não aparecem.</p>
    </div>
  );
}

function RangesEditor({ ranges, onChange, label }: { ranges: Range[]; onChange: (r: Range[]) => void; label: string }) {
  const p = (n: number) => `${String(n).padStart(2, "0")}:00`;
  return (
    <div className="space-y-1.5">
      {ranges.map((r, k) => (
        <div key={k}>
          <div className="flex items-center gap-1">
            <input type="time" className={timeCls} value={r.start} onChange={(e) => onChange(ranges.map((x, n) => (n === k ? { ...x, start: e.target.value } : x)))} aria-label={`${label}: início do período ${k + 1}`} />
            <span className="text-[11px] text-slate-400">às</span>
            <input type="time" className={timeCls} value={r.end} onChange={(e) => onChange(ranges.map((x, n) => (n === k ? { ...x, end: e.target.value } : x)))} aria-label={`${label}: fim do período ${k + 1}`} />
            <button type="button" aria-label={`Remover período ${k + 1}`} onClick={() => onChange(ranges.filter((_, n) => n !== k))} className="rounded p-1 text-slate-400 hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
          </div>
          {!(r.start && r.end && r.end > r.start) && <p className="mt-0.5 text-[11px] text-amber-700">O fim precisa ser depois do início.</p>}
        </div>
      ))}
      {ranges.length < BLOCK_MAX_RANGES && (
        <button type="button" onClick={() => { const h = ranges.at(-1)?.end ? Math.min(22, Number(ranges.at(-1)!.end.slice(0, 2))) : 9; onChange([...ranges, { start: p(h), end: p(Math.min(23, h + 1)) }]); }}
          className="flex items-center gap-1 text-[11px] font-medium text-emerald-700"><Plus className="h-3 w-3" /> Outro período</button>
      )}
    </div>
  );
}

// Intervalo entre horários e como a pessoa vê as datas.
function ViewAndStep({ c, step, onChange }: { c: StepConfig; step: number; onChange: (p: Partial<StepConfig>) => void }) {
  const view = c.booking_view ?? (blockMode(c) === "dates" ? "month" : "week");
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs font-medium text-slate-500">Horários a cada
        <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700" value={step} onChange={(e) => onChange({ booking_slot_minutes: Number(e.target.value) })}>
          {STEPS.map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-500">Quem agenda vê
        <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700" value={view} onChange={(e) => onChange({ booking_view: e.target.value as "week" | "month" })}>
          <option value="month">O mês</option>
          <option value="week">A semana</option>
        </select>
      </label>
    </div>
  );
}

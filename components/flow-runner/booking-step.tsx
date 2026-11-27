"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck2, CalendarPlus, ChevronLeft, ChevronRight, Clock, Loader2, UserRound } from "lucide-react";
import type { ContactInfo, FlowStep } from "@/lib/types";
import { addDays, applyBlockHours, blockMode, brToday, computeSlots, DEFAULT_BOOKING_SETTINGS, openDaysLabel } from "@/lib/booking/slots";

// Bloco "Agendamento": o paciente escolhe um horário livre da Agenda da
// clínica. Os horários vêm do servidor (regras + agenda real); no editor e no
// modo demonstração, horários de exemplo são gerados aqui mesmo.

export interface BookingDone {
  id: string; token: string | null; date: string; time: string;
  procedure: string; professional: string; name: string; phone: string;
}
interface Day { date: string; weekday: number; closed: string | null; slots: string[] }

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WD_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PAGE = 7;

// Visão do mês: busca do dia `from` até o fim do mês; navega de mês em mês.
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const nextMonth = (d: string) => { const [y, m] = d.split("-").map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; };
const prevMonth = (d: string) => { const [y, m] = d.split("-").map(Number); return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`; };
const spanFrom = (from: string, month: boolean) => (month ? Math.round((Date.parse(`${nextMonth(from)}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) : PAGE);

const newRef = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

function demoDays(from: string, c: FlowStep["config"], span = PAGE): Day[] {
  return computeSlots({ settings: applyBlockHours(DEFAULT_BOOKING_SETTINGS, c), from, to: addDays(from, span - 1), duration: Number(c.booking_duration) || 60, professionals: ["demo"], busy: [], now: new Date() })
    .map((d) => ({ date: d.date, weekday: d.weekday, closed: d.closed, slots: d.slots.filter((_, i) => blockMode(c) !== "clinic" || i % 3 !== 1).map((s) => s.time) }));
}

function prettyDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return `${WD_LONG[d.getUTCDay()]}, ${date.slice(8, 10)} de ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

// Link "Adicionar ao Google Agenda" (abre o Google; nada é enviado pela Cliva).
function googleCalendarUrl(b: BookingDone, duration: number, clinic: string) {
  const start = new Date(`${b.date}T${b.time}:00-03:00`);
  const end = new Date(start.getTime() + duration * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({ action: "TEMPLATE", text: `${b.procedure} — ${clinic}`, dates: `${f(start)}/${f(end)}`, details: `Agendado pelo site. Profissional: ${b.professional}.` });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function BookingStep({
  step, flowId, clinicName, preview, contact, getLead, finishOnConfirm = false, onDone,
}: {
  step: FlowStep;
  flowId: string;
  clinicName: string;
  preview: boolean;
  contact: ContactInfo;
  getLead: () => Promise<{ id: string; token: string } | null>; // lead já gravado (liga ao agendamento)
  finishOnConfirm?: boolean; // última etapa: conclui ao confirmar, sem botão "Continuar"
  onDone: (b: BookingDone) => void;
}) {
  const c = step.config;
  // Datas escolhidas uma a uma pedem o calendário do mês; o resto, a faixa da semana.
  const monthView = (c.booking_view ?? (blockMode(c) === "dates" ? "month" : "week")) === "month";
  const [from, setFrom] = useState(() => brToday(new Date()));
  const [days, setDays] = useState<Day[] | null>(null);
  const [meta, setMeta] = useState({ procedure: c.booking_procedure || "Avaliação", duration: Number(c.booking_duration) || 60, maxAhead: applyBlockHours(DEFAULT_BOOKING_SETTINGS, c).max_days_ahead, noPros: false, openDays: blockMode(c) === "dates" ? "" : openDaysLabel(applyBlockHours(DEFAULT_BOOKING_SETTINGS, c).hours) });
  const autoHops = useRef(0); // pula sozinho semanas sem horário (até 8), só na abertura
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState(contact.name ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingDone | null>(null);
  const ref = useRef<string>(newRef());
  const askContact = (c.booking_ask_contact ?? true) && !(contact.name && (contact.phone ?? "").replace(/\D/g, "").length >= 10);

  const load = useCallback(async (start: string, keepSelection = false) => {
    setDays(null);
    if (!keepSelection) { setDate(null); setTime(null); }
    if (preview) { setDays(demoDays(start, c, spanFrom(start, monthView))); return; }
    try {
      const q = new URLSearchParams({ flow_id: flowId, step_id: step.id, from: start, days: String(spanFrom(start, monthView)) });
      const res = await fetch(`/api/booking/slots?${q.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "erro");
      if (json.demo) { setDays(demoDays(start, c, spanFrom(start, monthView))); return; }
      setMeta({ procedure: json.procedure, duration: json.duration, maxAhead: json.max_days_ahead, noPros: json.no_professionals, openDays: json.open_days ?? "" });
      setDays(json.days as Day[]);
    } catch {
      setError("Não foi possível carregar os horários. Tente de novo em instantes.");
      setDays([]);
    }
  }, [flowId, step.id, preview, c, monthView]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial dos horários
  useEffect(() => { void load(from); }, [load, from]);

  // Seleciona sozinho o primeiro dia com horário.
  useEffect(() => {
    if (!days || date) return;
    const first = days.find((d) => !d.closed && d.slots.length > 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- escolha automática ao carregar
    if (first) { autoHops.current = 99; setDate(first.date); return; }
    const next = monthView ? nextMonth(from) : addDays(from, PAGE);
    if (days.length > 0 && !meta.noPros && autoHops.current < 8 && next <= addDays(brToday(new Date()), meta.maxAhead)) {
      autoHops.current += 1;
      setFrom(next);
    }
  }, [days, date, from, meta.noPros, meta.maxAhead, monthView]);

  const today = brToday(new Date());
  const lastDay = addDays(today, meta.maxAhead);
  const day = days?.find((d) => d.date === date) ?? null;
  const groups = useMemo(() => {
    const g: Record<string, string[]> = { Manhã: [], Tarde: [], Noite: [] };
    for (const t of day?.slots ?? []) g[Number(t.slice(0, 2)) < 12 ? "Manhã" : Number(t.slice(0, 2)) < 18 ? "Tarde" : "Noite"].push(t);
    return Object.entries(g).filter(([, v]) => v.length > 0);
  }, [day]);

  const phoneDigits = phone.replace(/\D/g, "");
  const canConfirm = Boolean(date && time && name.trim().length >= 2 && phoneDigits.length >= 10 && !busy);

  const finish = (b: BookingDone) => {
    setDone(b);
    if (finishOnConfirm) onDone(b);
  };

  async function confirm() {
    if (!date || !time) return;
    setError(null);
    if (preview) {
      finish({ id: "preview", token: null, date, time, procedure: meta.procedure, professional: "Profissional da clínica", name, phone: phoneDigits });
      return;
    }
    setBusy(true);
    try {
      const lead = await getLead();
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow_id: flowId, step_id: step.id, date, time, booking_ref: ref.current, name: name.trim(), phone: phoneDigits, lead: lead ?? undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        finish({ id: json.id, token: json.token ?? null, date, time, procedure: json.procedure ?? meta.procedure, professional: json.professional ?? "Profissional da clínica", name: name.trim(), phone: phoneDigits });
        return;
      }
      if (json.error === "slot_taken") {
        setError("Esse horário acabou de ser ocupado. Escolha outro, por favor.");
        ref.current = newRef();
        setTime(null);
        await load(from, true);
      } else if (json.error === "booking_disabled") setError("A clínica não está recebendo agendamentos online no momento. Fale pelo WhatsApp.");
      else if (res.status === 429) setError("Muitas tentativas. Aguarde um minuto e tente de novo.");
      else setError("Não foi possível agendar agora. Tente de novo.");
    } catch {
      setError("Sem conexão. Confira sua internet e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CalendarCheck2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[color:var(--page-text,#0f172a)]">{c.booking_success_title || "Horário reservado!"}</h2>
        <p className="mt-2 text-slate-500">{c.booking_success_body || "A clínica vai confirmar com você pelo WhatsApp."}</p>
        <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-slate-200 p-4 text-left text-sm">
          <p className="font-semibold text-slate-900 first-letter:uppercase">{prettyDate(done.date)} às {done.time}</p>
          <p className="mt-1 text-slate-600">{done.procedure} · {meta.duration} min</p>
          <p className="flex items-center gap-1.5 text-slate-500"><UserRound className="h-3.5 w-3.5" /> {done.professional}</p>
        </div>
        <a href={googleCalendarUrl(done, meta.duration, clinicName)} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline-offset-2 hover:underline">
          <CalendarPlus className="h-4 w-4" /> Adicionar ao Google Agenda
        </a>
        {!finishOnConfirm && <div className="cta-dock mt-6">
          <button onClick={() => onDone(done)} className="brand-btn flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold shadow-lg">
            {c.button_label || "Continuar"} <ChevronRight className="h-4 w-4" />
          </button>
        </div>}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-[color:var(--page-text,#0f172a)]">{c.title || "Escolha o melhor horário"}</h2>
      {c.subtitle && <p className="mt-1 text-slate-500">{c.subtitle}</p>}
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        <Clock className="h-3.5 w-3.5 shrink-0" /> {meta.procedure} · {meta.duration} min
      </p>
      {meta.openDays && <p className="mt-2 text-sm text-slate-500">Dias disponíveis: {meta.openDays}.</p>}

      {/* Dias: calendário do mês */}
      {monthView && (
        <div className="mt-5 rounded-2xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" disabled={from <= today} onClick={() => { autoHops.current = 99; const p = prevMonth(from); setFrom(p < today ? today : p); }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <p className="text-sm font-semibold capitalize text-slate-800">{MONTHS_LONG[Number(from.slice(5, 7)) - 1]} {from.slice(0, 4)}</p>
            <button type="button" aria-label="Próximo mês" disabled={nextMonth(from) > lastDay} onClick={() => { autoHops.current = 99; setFrom(nextMonth(from)); }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WD.map((w) => <span key={w} className="pb-1 text-[11px] font-medium text-slate-400">{w}</span>)}
            {Array.from({ length: new Date(`${monthStart(from)}T12:00:00Z`).getUTCDay() }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: spanFrom(monthStart(from), true) }, (_, i) => addDays(monthStart(from), i)).map((ds) => {
              const d = days?.find((x) => x.date === ds);
              const off = !d || Boolean(d.closed) || d.slots.length === 0;
              const sel = ds === date;
              return (
                <button key={ds} type="button" disabled={off} aria-pressed={sel} aria-label={prettyDate(ds)} title={d?.closed ?? undefined}
                  onClick={() => { setDate(ds); setTime(null); }}
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${sel ? "bg-[color:var(--brand)] font-bold text-white" : off ? "text-slate-300" : "bg-[color-mix(in_srgb,var(--brand)_14%,white)] font-semibold text-[color:var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_24%,white)]"}`}>
                  {Number(ds.slice(8, 10))}
                </button>
              );
            })}
          </div>
          {days && !days.some((d) => !d.closed && d.slots.length > 0) && <p className="mt-2 text-center text-xs text-slate-500">Sem datas livres neste mês.</p>}
        </div>
      )}

      {/* Dias: faixa da semana */}
      {!monthView && <>
      <div className="mt-5 flex items-center gap-2">
        <button type="button" aria-label="Dias anteriores" disabled={from <= today} onClick={() => { autoHops.current = 99; setFrom(addDays(from, -PAGE) < today ? today : addDays(from, -PAGE)); }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {(days ?? Array.from({ length: PAGE }, (_, i) => ({ date: addDays(from, i), weekday: -1, closed: null, slots: [] as string[] }))).map((d) => {
            const wd = new Date(`${d.date}T12:00:00Z`).getUTCDay();
            const off = !days || Boolean(d.closed) || d.slots.length === 0;
            const sel = d.date === date;
            return (
              <button key={d.date} type="button" disabled={off} title={d.closed ?? undefined} aria-pressed={sel}
                onClick={() => { setDate(d.date); setTime(null); }}
                className={`flex flex-col items-center rounded-xl border py-2 text-xs transition-colors ${sel ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white" : off ? "border-transparent text-slate-300" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>
                <span className="font-medium">{WD[wd]}</span>
                <span className="text-base font-bold">{d.date.slice(8, 10)}</span>
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Próximos dias" disabled={addDays(from, PAGE) > lastDay} onClick={() => { autoHops.current = 99; setFrom(addDays(from, PAGE)); }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-center text-[11px] capitalize text-slate-400">{MONTHS[Number(from.slice(5, 7)) - 1]} {from.slice(0, 4)}</p>
      </>}

      {/* Horários */}
      <div className="mt-4 min-h-[140px]">
        {!days ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Buscando horários livres…</p>
        ) : meta.noPros ? (
          <p className="py-8 text-center text-sm text-slate-500">A clínica ainda não abriu horários para agendamento online.</p>
        ) : !day ? (
          <p className="py-8 text-center text-sm text-slate-500">{monthView ? "Escolha uma data destacada no calendário." : "Sem horários livres nestes dias. Veja os próximos dias na seta ao lado."}</p>
        ) : (
          groups.map(([label, times]) => (
            <div key={label} className="mb-3">
              <p className="mb-1.5 text-xs font-medium text-slate-400">{label}</p>
              <div className="grid grid-cols-4 gap-2">
                {times.map((t) => (
                  <button key={t} type="button" aria-pressed={t === time} onClick={() => setTime(t)}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${t === time ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Contato (só se o funil ainda não pediu) */}
      {date && time && askContact && (
        <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-base focus:border-[color:var(--brand)] focus:outline-none" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp com DDD" inputMode="tel" autoComplete="tel"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-base focus:border-[color:var(--brand)] focus:outline-none" />
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="cta-dock mt-5">
        <button type="button" disabled={!canConfirm} onClick={confirm}
          className="brand-btn flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold shadow-lg disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
          {date && time ? `Agendar ${WD[new Date(`${date}T12:00:00Z`).getUTCDay()].toLowerCase()} ${date.slice(8, 10)}/${date.slice(5, 7)} às ${time}` : "Escolha um horário"}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">Seus dados vão só para a clínica. Você pode remarcar pelo WhatsApp.</p>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck2, CalendarPlus, ChevronLeft, ChevronRight, Clock, Loader2, UserRound } from "lucide-react";
import type { ContactInfo, FlowStep } from "@/lib/types";
import { addDays, brToday, computeSlots, DEFAULT_BOOKING_SETTINGS } from "@/lib/booking/slots";

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
const PAGE = 7;

const newRef = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

function demoDays(from: string): Day[] {
  return computeSlots({ settings: DEFAULT_BOOKING_SETTINGS, from, to: addDays(from, PAGE - 1), duration: 60, professionals: ["demo"], busy: [], now: new Date() })
    .map((d) => ({ date: d.date, weekday: d.weekday, closed: d.closed, slots: d.slots.filter((_, i) => i % 3 !== 1).map((s) => s.time) }));
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
  step, flowId, clinicName, preview, contact, getLead, onDone,
}: {
  step: FlowStep;
  flowId: string;
  clinicName: string;
  preview: boolean;
  contact: ContactInfo;
  getLead: () => { id: string; token: string } | null; // lead já gravado (liga ao agendamento)
  onDone: (b: BookingDone) => void;
}) {
  const c = step.config;
  const [from, setFrom] = useState(() => brToday(new Date()));
  const [days, setDays] = useState<Day[] | null>(null);
  const [meta, setMeta] = useState({ procedure: c.booking_procedure || "Avaliação", duration: Number(c.booking_duration) || 60, maxAhead: 30, noPros: false });
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState(contact.name ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingDone | null>(null);
  const ref = useRef<string>(newRef());
  const askContact = (c.booking_ask_contact ?? true) && !(contact.name && contact.phone);

  const load = useCallback(async (start: string, keepSelection = false) => {
    setDays(null);
    if (!keepSelection) { setDate(null); setTime(null); }
    if (preview) { setDays(demoDays(start)); return; }
    try {
      const q = new URLSearchParams({ flow_id: flowId, step_id: step.id, from: start, days: String(PAGE) });
      const res = await fetch(`/api/booking/slots?${q.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "erro");
      if (json.demo) { setDays(demoDays(start)); return; }
      setMeta({ procedure: json.procedure, duration: json.duration, maxAhead: json.max_days_ahead, noPros: json.no_professionals });
      setDays(json.days as Day[]);
    } catch {
      setError("Não foi possível carregar os horários. Tente de novo em instantes.");
      setDays([]);
    }
  }, [flowId, step.id, preview]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial dos horários
  useEffect(() => { void load(from); }, [load, from]);

  // Seleciona sozinho o primeiro dia com horário.
  useEffect(() => {
    if (!days || date) return;
    const first = days.find((d) => !d.closed && d.slots.length > 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- escolha automática ao carregar
    if (first) setDate(first.date);
  }, [days, date]);

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

  async function confirm() {
    if (!date || !time) return;
    setError(null);
    if (preview) {
      setDone({ id: "preview", token: null, date, time, procedure: meta.procedure, professional: "Profissional da clínica", name, phone: phoneDigits });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow_id: flowId, step_id: step.id, date, time, booking_ref: ref.current, name: name.trim(), phone: phoneDigits, lead: getLead() ?? undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setDone({ id: json.id, token: json.token ?? null, date, time, procedure: json.procedure ?? meta.procedure, professional: json.professional ?? "Profissional da clínica", name: name.trim(), phone: phoneDigits });
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
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{c.booking_success_title || "Horário reservado!"}</h2>
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
        <div className="cta-dock mt-6">
          <button onClick={() => onDone(done)} className="brand-btn flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold shadow-lg">
            {c.button_label || "Continuar"} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{c.title || "Escolha o melhor horário"}</h2>
      {c.subtitle && <p className="mt-1 text-slate-500">{c.subtitle}</p>}
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        <Clock className="h-3.5 w-3.5" /> {meta.procedure} · {meta.duration} min
      </p>

      {/* Dias */}
      <div className="mt-5 flex items-center gap-2">
        <button type="button" aria-label="Dias anteriores" disabled={from <= today} onClick={() => setFrom(addDays(from, -PAGE) < today ? today : addDays(from, -PAGE))}
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
        <button type="button" aria-label="Próximos dias" disabled={addDays(from, PAGE) > lastDay} onClick={() => setFrom(addDays(from, PAGE))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-center text-[11px] capitalize text-slate-400">{MONTHS[Number(from.slice(5, 7)) - 1]} {from.slice(0, 4)}</p>

      {/* Horários */}
      <div className="mt-4 min-h-[140px]">
        {!days ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Buscando horários livres…</p>
        ) : meta.noPros ? (
          <p className="py-8 text-center text-sm text-slate-500">A clínica ainda não abriu horários para agendamento online.</p>
        ) : !day ? (
          <p className="py-8 text-center text-sm text-slate-500">Sem horários livres nestes dias. Veja os próximos dias na seta ao lado.</p>
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

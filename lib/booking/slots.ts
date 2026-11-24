import { holidayName } from "./holidays";
import type { BookingBlockDay, StepConfig } from "@/lib/types";

// Agendamento online: regras da clínica e cálculo de horários livres.
// Tudo no fuso de Brasília (UTC-3, sem horário de verão desde 2019).

export interface DayHours { open: boolean; start: string; end: string; break_start?: string | null; break_end?: string | null; ranges?: { start: string; end: string }[] }
export interface BookingSettings {
  enabled: boolean;
  hours: DayHours[];          // 0 = domingo … 6 = sábado
  slot_minutes: number;       // espaço entre horários oferecidos
  min_notice_minutes: number; // antecedência mínima
  max_days_ahead: number;     // até quantos dias à frente
  skip_holidays: boolean;
  blocked_dates: string[];    // AAAA-MM-DD
  auto_confirm: boolean;      // entra como "confirmado" (senão "aguardando")
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  enabled: true,
  hours: [
    { open: false, start: "08:00", end: "12:00" },
    { open: true, start: "08:00", end: "18:00", break_start: "12:00", break_end: "13:00" },
    { open: true, start: "08:00", end: "18:00", break_start: "12:00", break_end: "13:00" },
    { open: true, start: "08:00", end: "18:00", break_start: "12:00", break_end: "13:00" },
    { open: true, start: "08:00", end: "18:00", break_start: "12:00", break_end: "13:00" },
    { open: true, start: "08:00", end: "18:00", break_start: "12:00", break_end: "13:00" },
    { open: true, start: "08:00", end: "12:00" },
  ],
  slot_minutes: 30,
  min_notice_minutes: 120,
  max_days_ahead: 30,
  skip_holidays: true,
  blocked_dates: [],
  auto_confirm: false,
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Normaliza o que vem do banco/formulário: valores fora do padrão viram o padrão.
export function normalizeBookingSettings(raw: unknown): BookingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<BookingSettings>;
  const d = DEFAULT_BOOKING_SETTINGS;
  const hours = Array.from({ length: 7 }, (_, i) => {
    const h = (Array.isArray(r.hours) ? r.hours[i] : undefined) as Partial<DayHours> | undefined;
    const base = d.hours[i];
    if (!h) return base;
    const start = HHMM.test(h.start ?? "") ? h.start! : base.start;
    const end = HHMM.test(h.end ?? "") && toMin(h.end!) > toMin(start) ? h.end! : base.end;
    const bs = HHMM.test(h.break_start ?? "") ? h.break_start! : null;
    const be = HHMM.test(h.break_end ?? "") ? h.break_end! : null;
    const validBreak = bs && be && toMin(be) > toMin(bs) && toMin(bs) >= toMin(start) && toMin(be) <= toMin(end);
    return { open: Boolean(h.open), start, end, break_start: validBreak ? bs : null, break_end: validBreak ? be : null };
  });
  const int = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  };
  return {
    enabled: r.enabled === undefined ? d.enabled : Boolean(r.enabled),
    hours,
    slot_minutes: [15, 20, 30, 45, 60, 90, 120].includes(Number(r.slot_minutes)) ? Number(r.slot_minutes) : d.slot_minutes,
    min_notice_minutes: int(r.min_notice_minutes, 0, 7 * 24 * 60, d.min_notice_minutes),
    max_days_ahead: int(r.max_days_ahead, 1, 180, d.max_days_ahead),
    skip_holidays: r.skip_holidays === undefined ? d.skip_holidays : Boolean(r.skip_holidays),
    blocked_dates: (Array.isArray(r.blocked_dates) ? r.blocked_dates : []).filter((x): x is string => typeof x === "string" && YMD.test(x)).slice(0, 366),
    auto_confirm: Boolean(r.auto_confirm),
  };
}

export function brToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// "2026-10-23" + "14:30" → instante UTC.
export function localToUtc(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00-03:00`);
}

export interface Busy { professional_id: string; start: Date; end: Date }
export interface Slot { time: string; start: string; professionals: string[] }
export interface DaySlots { date: string; weekday: number; closed: string | null; slots: Slot[] }

// Por que o dia não tem horário (para a tela do paciente). null = aberto.
export function closedReason(s: BookingSettings, date: string, today: string): string | null {
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (date < today) return "Data passada";
  if (date > addDays(today, s.max_days_ahead)) return "Agenda ainda não aberta";
  if (s.blocked_dates.includes(date)) return "Fechado";
  if (s.skip_holidays) { const h = holidayName(date); if (h) return `Feriado: ${h}`; }
  if (!s.hours[wd]?.open) return "Fechado";
  return null;
}

const SLOT_STEPS = [15, 20, 30, 45, 60, 90, 120];
export const BLOCK_MAX_RANGES = 6;

// Dias/horários definidos no próprio bloco: períodos válidos, em ordem e sem
// sobreposição. undefined = o bloco usa o horário da clínica.
export function normalizeBlockHours(raw: unknown): BookingBlockDay[] | undefined {
  if (!Array.isArray(raw) || raw.length !== 7) return undefined;
  return raw.map((d) => {
    const day = (d && typeof d === "object" ? d : {}) as Partial<BookingBlockDay>;
    const sorted = (Array.isArray(day.ranges) ? day.ranges : [])
      .filter((r) => r && HHMM.test(r.start ?? "") && HHMM.test(r.end ?? "") && toMin(r.end) > toMin(r.start))
      .map((r) => ({ start: r.start, end: r.end }))
      .sort((a, b) => toMin(a.start) - toMin(b.start))
      .slice(0, BLOCK_MAX_RANGES);
    const ranges: { start: string; end: string }[] = [];
    for (const r of sorted) {
      const last = ranges.at(-1);
      if (last && toMin(r.start) <= toMin(last.end)) { if (toMin(r.end) > toMin(last.end)) last.end = r.end; }
      else ranges.push(r);
    }
    return { open: Boolean(day.open) && ranges.length > 0, ranges };
  });
}

// Regras da clínica com os dias/horários do bloco por cima. Feriados, datas
// bloqueadas, antecedência e janela continuam sendo os da clínica.
export function applyBlockHours(s: BookingSettings, c: Pick<StepConfig, "booking_hours" | "booking_slot_minutes">): BookingSettings {
  const block = normalizeBlockHours(c.booking_hours);
  const step = Number(c.booking_slot_minutes);
  return {
    ...s,
    ...(SLOT_STEPS.includes(step) ? { slot_minutes: step } : {}),
    ...(block ? { hours: block.map((d, i) => ({ ...s.hours[i], open: d.open, ranges: d.ranges, break_start: null, break_end: null })) } : {}),
  };
}

// Horários de início possíveis num dia (minutos desde 00:00).
export function startMinutes(h: DayHours, duration: number, step: number): number[] {
  const out: number[] = [];
  const windows = h.ranges ?? [{ start: h.start, end: h.end }];
  const bs = h.break_start ? toMin(h.break_start) : null, be = h.break_end ? toMin(h.break_end) : null;
  for (const w of windows) {
    for (let m = toMin(w.start); m + duration <= toMin(w.end); m += step) {
      if (bs !== null && be !== null && m < be && m + duration > bs) continue; // invade a pausa
      out.push(m);
    }
  }
  return out;
}
export const minutesToHHMM = (m: number) => toHHMM(m);

// "terça e quinta", "segunda a sexta": dias abertos, para a tela do paciente.
export function openDaysLabel(hours: Pick<DayHours, "open">[]): string {
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const idx = [1, 2, 3, 4, 5, 6, 0].filter((i) => hours[i]?.open);
  if (idx.length === 0) return "";
  if (idx.length === 7) return "todos os dias";
  const pos = idx.map((i) => (i + 6) % 7);
  if (idx.length >= 3 && pos.every((p, k) => k === 0 || p === pos[k - 1] + 1)) return `${names[idx[0]]} a ${names[idx.at(-1)!]}`;
  const list = idx.map((i) => names[i]);
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} e ${list.at(-1)}`;
}

// Horários livres entre `from` e `to` (inclusive) para um atendimento de
// `duration` minutos. Um horário vale se pelo menos um profissional estiver
// livre no intervalo inteiro. Respeita pausa, antecedência e janela máxima.
export function computeSlots(p: {
  settings: BookingSettings; from: string; to: string; duration: number;
  professionals: string[]; busy: Busy[]; now: Date;
}): DaySlots[] {
  const { settings: s, duration } = p;
  const today = brToday(p.now);
  const earliest = p.now.getTime() + s.min_notice_minutes * 60000;
  const out: DaySlots[] = [];
  for (let date = p.from; date <= p.to; date = addDays(date, 1)) {
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    const closed = s.enabled ? closedReason(s, date, today) : "Agendamento online desligado";
    const day: DaySlots = { date, weekday: wd, closed, slots: [] };
    if (!closed && p.professionals.length > 0) {
      const h = s.hours[wd];
      for (const m of startMinutes(h, duration, s.slot_minutes)) {
        const start = localToUtc(date, toHHMM(m));
        if (start.getTime() < earliest) continue;
        const end = new Date(start.getTime() + duration * 60000);
        const free = p.professionals.filter((pid) => !p.busy.some((b) => b.professional_id === pid && b.start < end && b.end > start));
        if (free.length > 0) day.slots.push({ time: toHHMM(m), start: start.toISOString(), professionals: free });
      }
      if (day.slots.length === 0) day.closed = "Sem horários livres";
    }
    out.push(day);
  }
  return out;
}

// Confere um horário pedido pelo paciente (o navegador pode mandar qualquer coisa).
export function isOfferedSlot(p: Parameters<typeof computeSlots>[0] & { date: string; time: string }): string[] {
  const day = computeSlots({ ...p, from: p.date, to: p.date })[0];
  return day?.slots.find((x) => x.time === p.time)?.professionals ?? [];
}

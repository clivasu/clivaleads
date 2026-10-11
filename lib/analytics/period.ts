// Períodos do painel no fuso de Brasília (UTC-3, sem horário de verão desde 2019).
// Intervalos são meio-abertos: [from, to). O período anterior tem o mesmo tamanho
// e termina onde o atual começa, para as comparações serem justas.

export const RANGES = {
  "7d": { label: "Últimos 7 dias", days: 7, bucket: "day" },
  "30d": { label: "Últimos 30 dias", days: 30, bucket: "day" },
  "90d": { label: "Últimos 90 dias", days: 90, bucket: "week" },
  "12m": { label: "Últimos 12 meses", months: 12, bucket: "month" },
} as const;
export type RangeKey = keyof typeof RANGES;
export type Bucket = "day" | "week" | "month";

export interface Period {
  range: RangeKey;
  label: string;
  bucket: Bucket;
  from: string; // ISO UTC
  to: string;
  prevFrom: string;
  prevTo: string;
}

export function isRangeKey(v: unknown): v is RangeKey {
  return typeof v === "string" && v in RANGES;
}

// "2026-10-11" no fuso de Brasília.
export function brDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Meia-noite de Brasília de uma data "AAAA-MM-DD", em UTC.
function brMidnight(ymd: string): Date {
  return new Date(`${ymd}T03:00:00.000Z`);
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(ymd: string, n: number): string {
  const [y, m] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  return d.toISOString().slice(0, 10);
}

export function resolvePeriod(range: RangeKey, now: Date = new Date()): Period {
  const def = RANGES[range];
  const today = brDate(now);
  const end = addDays(today, 1); // amanhã 00:00 (inclui o dia de hoje inteiro)
  let start: string;
  let prevStart: string;
  if ("months" in def) {
    start = addMonths(`${today.slice(0, 7)}-01`, -(def.months - 1));
    prevStart = addMonths(start, -def.months);
  } else {
    start = addDays(end, -def.days);
    prevStart = addDays(start, -def.days);
  }
  return {
    range,
    label: def.label,
    bucket: def.bucket,
    from: brMidnight(start).toISOString(),
    to: brMidnight(end).toISOString(),
    prevFrom: brMidnight(prevStart).toISOString(),
    prevTo: brMidnight(start).toISOString(),
  };
}

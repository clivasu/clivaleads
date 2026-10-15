// Período do Dashboard (fuso de Brasília). Intervalo [from, to).
export type DashPresetKey = "este-mes" | "15d" | "mes-passado" | "personalizado";
export type DashBucket = "day" | "month" | "year";

export interface DashPeriod {
  key: DashPresetKey;
  label: string;          // "Este mês", "01/08/2026 – 15/08/2026"…
  compareLabel: string;   // "vs mesmo trecho de set/2026"
  from: string;           // ISO UTC
  to: string;
  de: string;             // AAAA-MM-DD (primeiro dia)
  ate: string;            // AAAA-MM-DD (último dia, inclusive)
  bucket: DashBucket;
  bucketAuto: boolean;
}

export const DASH_PRESETS: { key: DashPresetKey; label: string }[] = [
  { key: "este-mes", label: "Este mês" },
  { key: "15d", label: "Últimos 15 dias" },
  { key: "mes-passado", label: "Mês passado" },
  { key: "personalizado", label: "Personalizar" },
];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function brToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
const midnight = (ymd: string) => new Date(`${ymd}T03:00:00.000Z`); // 00:00 em Brasília
function addDays(ymd: string, n: number) { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function addMonths(ymd: string, n: number) { const [y, m] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1, 12)).toISOString().slice(0, 10); }
const fmt = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
const monthLabel = (ymd: string) => `${MONTHS[Number(ymd.slice(5, 7)) - 1]}/${ymd.slice(0, 4)}`;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;

export function autoBucket(nDays: number): DashBucket {
  if (nDays <= 62) return "day";
  if (nDays <= 1100) return "month";
  return "year";
}

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v)?.trim() ?? ""; };

export function resolveDashPeriod(sp: SP, now: Date = new Date()): DashPeriod {
  const today = brToday(now);
  const raw = one(sp, "periodo") as DashPresetKey;
  let key: DashPresetKey = DASH_PRESETS.some((p) => p.key === raw) ? raw : "este-mes";
  let de: string, ate: string, label: string, compareLabel: string;

  if (key === "personalizado") {
    let a = one(sp, "de"), b = one(sp, "ate");
    if (!YMD.test(a) || !YMD.test(b) || Number.isNaN(Date.parse(a)) || Number.isNaN(Date.parse(b))) key = "este-mes";
    else {
      if (a > b) [a, b] = [b, a];
      if (days(a, b) > 366 * 5) a = addDays(b, -(366 * 5 - 1)); // até 5 anos
      de = a; ate = b;
    }
  }
  if (key === "15d") { ate = today; de = addDays(today, -14); }
  if (key === "mes-passado") { de = addMonths(`${today.slice(0, 7)}-01`, -1); ate = addDays(`${today.slice(0, 7)}-01`, -1); }
  if (key === "este-mes") { de = `${today.slice(0, 7)}-01`; ate = addDays(addMonths(de, 1), -1); }

  const n = days(de!, ate!);
  if (key === "este-mes") { label = "Este mês"; compareLabel = `vs mesmo trecho de ${monthLabel(addMonths(de!, -1))}`; }
  else if (key === "mes-passado") { label = `Mês passado (${monthLabel(de!)})`; compareLabel = `vs ${monthLabel(addMonths(de!, -1))}`; }
  else if (key === "15d") { label = "Últimos 15 dias"; compareLabel = "vs 15 dias anteriores"; }
  else { label = `${fmt(de!)} – ${fmt(ate!)}`; compareLabel = `vs ${n} dias anteriores`; }

  const b = one(sp, "agrupar");
  const bucketAuto = !(b === "day" || b === "month" || b === "year");
  return {
    key, label, compareLabel,
    from: midnight(de!).toISOString(),
    to: midnight(addDays(ate!, 1)).toISOString(),
    de: de!, ate: ate!,
    bucket: bucketAuto ? autoBucket(n) : (b as DashBucket),
    bucketAuto,
  };
}

export function dashQuery(p: { periodo: DashPresetKey; de?: string; ate?: string; agrupar?: DashBucket | null }): string {
  const q = new URLSearchParams();
  if (p.periodo !== "este-mes") q.set("periodo", p.periodo);
  if (p.periodo === "personalizado" && p.de && p.ate) { q.set("de", p.de); q.set("ate", p.ate); }
  if (p.agrupar) q.set("agrupar", p.agrupar);
  return q.toString();
}

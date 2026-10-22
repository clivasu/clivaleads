// Feriados nacionais do Brasil (fixos + móveis pela Páscoa). Carnaval entra
// porque a maioria das clínicas não atende; a clínica pode desligar a regra.

function easter(year: number): Date {
  // Algoritmo de Meeus/Jones/Butcher (calendário gregoriano).
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

const FIXED: [string, string][] = [
  ["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência"], ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"],
  ["11-15", "Proclamação da República"], ["11-20", "Consciência Negra"], ["12-25", "Natal"],
];

const cache = new Map<number, Map<string, string>>();

export function holidaysOf(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const map = new Map<string, string>();
  for (const [md, name] of FIXED) map.set(`${year}-${md}`, name);
  const e = easter(year);
  map.set(ymd(shift(e, -48)), "Carnaval");
  map.set(ymd(shift(e, -47)), "Carnaval");
  map.set(ymd(shift(e, -2)), "Sexta-feira Santa");
  map.set(ymd(shift(e, 60)), "Corpus Christi");
  cache.set(year, map);
  return map;
}

export function holidayName(date: string): string | null {
  return holidaysOf(Number(date.slice(0, 4))).get(date) ?? null;
}

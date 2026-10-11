// Conversão entre o modelo da tela da agenda (dia AAAA-MM-DD + hora decimal,
// ex.: 9.5 = 09:30) e o banco (timestamptz). A agenda usa o horário de
// Brasília (UTC-3, sem horário de verão desde 2019).
const OFFSET = "-03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;

export function toTimestamp(date: string, hour: number): string {
  const totalMin = Math.round(hour * 60);
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return new Date(`${date}T${h}:${m}:00${OFFSET}`).toISOString();
}

export function fromTimestamp(ts: string): { date: string; hour: number } {
  const br = new Date(new Date(ts).getTime() - OFFSET_MS);
  const date = br.toISOString().slice(0, 10);
  const hour = br.getUTCHours() + br.getUTCMinutes() / 60;
  return { date, hour };
}

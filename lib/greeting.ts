// Saudação conforme a hora: bom dia (5h–11h), boa tarde (12h–17h), boa noite.
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function formatToday(d: Date, timeZone?: string): string {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone });
}

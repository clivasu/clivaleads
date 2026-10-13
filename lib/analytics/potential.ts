// "Potencial estimado": ticket médio fixo por procedimento × leads que avançaram.
// Não é faturamento confirmado (não existe fonte de receita real no sistema).
const TICKET: Record<string, number> = {
  "Rinomodelação": 1200,
  "Botox Full Face": 900,
  "Preenchimento Labial": 800,
  "Harmonização Facial": 1500,
};
export const DEFAULT_TICKET = 800;

export function ticketFor(procedure: string | null | undefined): number {
  if (!procedure) return DEFAULT_TICKET;
  return TICKET[procedure] ?? DEFAULT_TICKET;
}

export function estimatePotential(procedures: { procedure: string; advanced: number }[]): number {
  return procedures.reduce((sum, p) => sum + p.advanced * ticketFor(p.procedure === "—" ? null : p.procedure), 0);
}

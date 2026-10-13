// Definições das métricas mostradas no painel (texto dos tooltips). A fonte de
// verdade das contagens é supabase/migrations/0013_events.sql (analytics_overview).

export interface Totals {
  visits: number;
  unique_visitors: number;
  starts: number;
  completions: number;
  exits: number;
  whatsapp_clicks: number;
  appointments: number;
  leads: number;
  leads_with_contact: number;
  qualified: number;
  warm: number;
  cold: number;
  final_cta: number;
  leads_whatsapp: number;
  devices_mobile: number;
  devices_desktop: number;
}

export const EMPTY_TOTALS: Totals = {
  visits: 0, unique_visitors: 0, starts: 0, completions: 0, exits: 0, whatsapp_clicks: 0,
  appointments: 0, leads: 0, leads_with_contact: 0, qualified: 0, warm: 0, cold: 0,
  final_cta: 0, leads_whatsapp: 0, devices_mobile: 0, devices_desktop: 0,
};

export const METRIC_DEFS = {
  visits: { label: "Visitas", def: "Vezes que a página do funil foi aberta. Recarregar a página conta outra visita." },
  unique_visitors: { label: "Visitantes únicos", def: "Navegadores diferentes que abriram o funil no período (identificador anônimo do navegador)." },
  starts: { label: "Inícios", def: "Visitas com a primeira interação real: responder, clicar ou avançar. Só abrir a página não conta." },
  completions: { label: "Conclusões", def: "Visitas que chegaram ao fim do caminho principal do funil. Quem foi para o final “sem interesse” não conta." },
  exits: { label: "Saídas", def: "Visitas que foram para o final “sem interesse” do funil." },
  not_finished: { label: "Não concluíram", def: "Inícios sem conclusão e sem saída no período. Inclui quem ainda pode voltar; não é abandono confirmado." },
  qualified: { label: "Qualificados", def: "Leads com score 61 ou mais (faixa quente). O score é calculado no servidor a partir das respostas." },
  whatsapp_clicks: { label: "Cliques no WhatsApp", def: "Visitas em que o WhatsApp foi aberto de fato. Enviar formulário ou ver a última tela não conta. Não indica que a conversa começou." },
  appointments: { label: "Agendamentos", def: "Leads marcados como agendado ou convertido pela clínica. Cada lead conta uma vez. Não indica comparecimento." },
  leads: { label: "Leads", def: "Respostas completas gravadas no período, com ou sem contato." },
  leads_with_contact: { label: "Leads com contato", def: "Leads que deixaram telefone ou e-mail." },
  final_cta: { label: "Botão final", def: "Leads que clicaram no botão final (formulário, “Continuar” ou link), sem abrir o WhatsApp por esse botão." },
  potential: { label: "Potencial estimado", def: "Soma de um ticket médio fixo por procedimento para os leads que avançaram (WhatsApp, agendado ou convertido). É estimativa, não faturamento." },
} as const;
export type MetricKey = keyof typeof METRIC_DEFS;

// Taxa em % com uma casa; null quando não há denominador (mostrar "—").
export function rate(n: number, d: number): number | null {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

// Variação % do período atual sobre o anterior; null sem base de comparação.
export function trend(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

export function fmtRate(r: number | null): string {
  return r === null ? "—" : `${r.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

// Funil com denominadores explícitos (cada etapa sobre a anterior).
export function conversionSteps(t: Totals) {
  return [
    { key: "visits", label: "Visitas", value: t.visits, rate: null as number | null, of: "" },
    { key: "starts", label: "Inícios", value: t.starts, rate: rate(t.starts, t.visits), of: "das visitas" },
    { key: "completions", label: "Conclusões", value: t.completions, rate: rate(t.completions, t.starts), of: "dos inícios" },
    { key: "whatsapp_clicks", label: "WhatsApp", value: t.whatsapp_clicks, rate: rate(t.whatsapp_clicks, t.completions), of: "das conclusões" },
    { key: "appointments", label: "Agendamentos", value: t.appointments, rate: rate(t.appointments, t.leads), of: "dos leads" },
  ];
}

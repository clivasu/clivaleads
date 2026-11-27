import type { FlowStep, LeadAnswer, StepConfig } from "@/lib/types";

// Personalização do funil: {nome} e as variáveis das perguntas viram o que a
// pessoa respondeu, em qualquer texto dos blocos seguintes.
//   {nome}           primeiro nome (do formulário ou do bloco mágico "Nome")
//   {nome_completo}  nome como foi escrito
//   {<variável>}     resposta de uma pergunta com "Nome da variável" preenchido

export type FunnelVars = Record<string, string>;

export const VAR_TYPES = new Set(["question", "multi_choice", "rating", "open_answer"]);
const TOKEN = /\{\s*([a-z0-9_]+)\s*\}/gi;

// "Maior dificuldade!" → "maior_dificuldade"
export function varKey(raw: string | null | undefined): string {
  return (raw ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

function flatten(steps: FlowStep[]): FlowStep[] {
  return steps.flatMap((s) => [s, ...flatten(s.children ?? [])]);
}

// Variáveis que o funil define (para o editor sugerir e para não mexer em {premio} etc.).
export function definedVars(steps: FlowStep[]): string[] {
  const keys = flatten(steps).filter((s) => VAR_TYPES.has(s.type)).map((s) => varKey(s.config.key)).filter(Boolean);
  return ["nome", "nome_completo", ...new Set(keys)];
}

const capFirst = (w: string) => (w ? w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1) : w);

export function buildVars(steps: FlowStep[], answers: LeadAnswer[], name?: string | null): FunnelVars {
  const v: FunnelVars = {};
  const full = (name ?? "").trim().replace(/\s+/g, " ");
  if (full) { v.nome = capFirst(full.split(" ")[0]); v.nome_completo = full; }
  for (const s of flatten(steps)) {
    const key = varKey(s.config.key);
    if (!key || !VAR_TYPES.has(s.type) || key === "nome" || key === "nome_completo") continue;
    const title = (s.config.title ?? "").trim();
    const a = [...answers].reverse().find((x) => x.question_title.trim() === title);
    if (a?.answer_label) v[key] = a.answer_label;
  }
  return v;
}

// Troca as variáveis. Sem resposta: na prévia do editor mostra um exemplo; no
// funil publicado some, arrumando vírgula e maiúscula ("{nome}, qual…" → "Qual…").
export function fillVars(text: string, vars: FunnelVars, known: Set<string>, preview = false): string {
  if (!text || !text.includes("{")) return text;
  let missing = false;
  const out = text.replace(TOKEN, (m, k: string) => {
    const key = k.toLowerCase();
    if (!known.has(key)) return m; // não é variável do funil (ex.: {premio} da roleta)
    if (vars[key]) return vars[key];
    if (preview) return key === "nome" ? "Ana" : key === "nome_completo" ? "Ana Souza" : `[${key}]`;
    missing = true;
    return "";
  });
  if (!missing) return out;
  const tidy = out
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/([,;:])\s*([.!?])/g, "$2")
    .replace(/([.!?])[ \t]*[,;:]+/g, "$1")
    .replace(/(^|\n)[ \t]*[,;:]+[ \t]*/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]*,[ \t]*$/gm, "")
    .trim();
  return tidy.replace(/(^|[.!?]\s+|\n)([a-zà-ú])/g, (_, p: string, c: string) => p + c.toLocaleUpperCase("pt-BR"));
}

const TEXT_KEYS = [
  "title", "subtitle", "body", "button_label", "caption", "quote", "author", "role", "kicker", "level_label", "gauge_caption",
  "consent", "booking_success_title", "booking_success_body", "invite_title", "invite_body", "invite_label", "invite_note",
  "file_label", "result_prefix", "cta_label", "chart_message", "chart_callout", "chart_warning", "highlight_word",
  "low_label", "high_label", "placeholder", "duration_label", "retry_label", "badge",
] as const;
const LIST_FIELDS: [keyof StepConfig, string[]][] = [
  ["options", ["label", "description"]], ["buttons", ["label"]], ["tiers", ["title", "body", "badge"]],
  ["faqs", ["q", "a"]], ["items", ["caption"]], ["stats", ["label"]], ["fields", ["label", "placeholder"]],
];

// Pergunta como a pessoa viu, para ler no painel ("{nome}, qual…" → "Maria, qual…").
export function answerTitle(title: string, name?: string | null): string {
  if (!title.includes("{")) return title;
  return fillVars(title, buildVars([], [], name), new Set(["nome", "nome_completo"]));
}

// Versão do bloco para exibir (o original continua sendo usado para gravar as respostas).
export function personalizeStep(step: FlowStep, vars: FunnelVars, known: Set<string>, preview = false): FlowStep {
  const c = step.config;
  if (!/\{\s*[a-z0-9_]+\s*\}/i.test(JSON.stringify(c))) return step;
  const f = (t: unknown) => (typeof t === "string" ? fillVars(t, vars, known, preview) : t);
  const next: Record<string, unknown> = { ...c };
  for (const k of TEXT_KEYS) if (typeof c[k] === "string") next[k] = f(c[k]);
  for (const k of ["paragraphs", "messages"] as const) if (Array.isArray(c[k])) next[k] = (c[k] as string[]).map(f);
  for (const [k, sub] of LIST_FIELDS) {
    const list = c[k];
    if (Array.isArray(list)) next[k] = list.map((it) => (it && typeof it === "object" ? Object.fromEntries(Object.entries(it).map(([a, b]) => [a, sub.includes(a) ? f(b) : b])) : it));
  }
  return { ...step, config: next as StepConfig };
}

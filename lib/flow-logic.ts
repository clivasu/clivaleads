import type { FlowStep } from "@/lib/types";

// Atalhos de destino usados nas opções, botões e regras.
export const GOTO_EXIT = "@exit"; // final "sem interesse"
export const GOTO_WHATSAPP = "@whatsapp"; // pula direto para o WhatsApp

// Detecção de respostas negativas, usada para sugerir (ou aplicar com um
// clique) o desvio para o final "sem interesse".
// 1) Frases que já dizem "não tenho interesse/intenção", em qualquer posição.
const STRONG_NEG =
  /(sem interesse|n[ãa]o tenho interesse|n[ãa]o (quero|pretendo|desejo|preciso)\b|(s[óo]|apenas|estou( s[óo]| apenas)?) pesquisando|s[óo] (por )?curiosidade|agora n[ãa]o|talvez (mais tarde|depois)|mais pra frente|n[ãa]o tenho (condi[çc][õo]es|dinheiro)|fora do (meu )?or[çc]amento|nenhuma das op[çc][õo]es|n[ãa]o [ée] pra mim)/i;
// 2) Um "Não" solto só conta quando a pergunta é sobre interesse/intenção —
//    "Você já fez algum procedimento? → Não" não desqualifica ninguém.
const BARE_NO = /^\s*n[ãa]o\b/i;
const INTENT_Q = /(interess|\bquer|gostaria|pretende|desej|agendar|marcar|avalia[çc][ãa]o|consulta|fazer|realizar|come[çc]ar|investir)/i;

export function isNegativeAnswer(label: string, question = ""): boolean {
  const l = label ?? "";
  return STRONG_NEG.test(l) || (BARE_NO.test(l) && INTENT_Q.test(question));
}

export const isExitStep = (s?: FlowStep) => s?.type === "exit";

// Última etapa do caminho principal (finais alternativos não contam).
export function lastMainIndex(steps: FlowStep[]): number {
  for (let i = steps.length - 1; i >= 0; i--) if (!isExitStep(steps[i])) return i;
  return Math.max(0, steps.length - 1);
}

// Próxima etapa no caminho normal, pulando finais alternativos.
// Retorna o próprio índice quando já não há para onde seguir.
export function nextLinear(steps: FlowStep[], i: number): number {
  for (let j = i + 1; j < steps.length; j++) if (!isExitStep(steps[j])) return j;
  return i;
}

export type GotoResult = number | "missing-exit" | undefined;

// Resolve um destino (id, atalho ou índice legado) para o índice da etapa.
export function resolveGoto(steps: FlowStep[], goto?: string, next?: number): GotoResult {
  if (goto) {
    if (goto === GOTO_EXIT) {
      const i = steps.findIndex(isExitStep);
      return i >= 0 ? i : "missing-exit";
    }
    if (goto === GOTO_WHATSAPP) {
      const i = steps.findIndex((s) => s.type === "whatsapp");
      return i >= 0 ? i : lastMainIndex(steps);
    }
    const i = steps.findIndex((s) => s.id === goto);
    if (i >= 0) return i;
  }
  return typeof next === "number" && next >= 0 && next < steps.length ? next : undefined;
}

export const EXIT_DEFAULTS: FlowStep["config"] = {
  title: "Tudo bem, obrigado por responder! 💚",
  body: "Pelo que você contou, este talvez não seja o momento certo para o procedimento. Quando fizer sentido, é só voltar por aqui que a gente te ajuda.",
  button_label: "",
  cta_href: "",
  exit_reason: "Sem interesse",
};

// Aplica a lógica inteligente: liga toda resposta negativa (sem destino) ao
// final "sem interesse" e cria esse final se ainda não existir.
export function applySmartLogic(
  steps: FlowStep[],
  makeExit: () => FlowStep,
): { steps: FlowStep[]; linked: number; createdExit: boolean } {
  let linked = 0;
  const walk = (list: FlowStep[]): FlowStep[] =>
    list.map((s) => {
      const c = s.config;
      let changed = false;
      const options = (c.options ?? []).map((o) => {
        if (!o.goto && typeof o.next !== "number" && isNegativeAnswer(o.label, c.title)) { linked++; changed = true; return { ...o, goto: GOTO_EXIT }; }
        return o;
      });
      const buttons = (c.buttons ?? []).map((b) => {
        if (!b.goto && typeof b.next !== "number" && !b.href && isNegativeAnswer(b.label, c.title)) { linked++; changed = true; return { ...b, goto: GOTO_EXIT }; }
        return b;
      });
      const children = s.children ? walk(s.children) : undefined;
      if (!changed && children === s.children) return s;
      return {
        ...s,
        config: { ...c, ...(c.options ? { options } : {}), ...(c.buttons ? { buttons } : {}) },
        ...(children ? { children } : {}),
      };
    });
  let next = walk(steps);
  const hasExit = next.some(isExitStep);
  const createdExit = linked > 0 && !hasExit;
  if (createdExit) next = [...next, makeExit()];
  return { steps: next, linked, createdExit };
}

// Rótulo legível de um destino (para o editor e o canvas).
export function gotoLabel(steps: FlowStep[], goto: string | undefined, labels: Record<string, string>): string {
  if (!goto) return "Seguir para a próxima";
  if (goto === GOTO_EXIT) return "Final: sem interesse";
  if (goto === GOTO_WHATSAPP) return "Direto para o WhatsApp";
  const i = steps.findIndex((s) => s.id === goto);
  return i >= 0 ? `${i + 1}. ${labels[steps[i].type] ?? steps[i].type}` : "Etapa removida";
}

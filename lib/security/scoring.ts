import type { FlowStep, LeadAnswer, QuestionOption } from "@/lib/types";

// Pontuação recalculada no servidor a partir da definição do funil.
// O score enviado pelo navegador é ignorado.
function flatten(steps: FlowStep[]): FlowStep[] {
  return steps.flatMap((s) => [s, ...flatten(s.children ?? [])]);
}

export function scoreAnswers(steps: FlowStep[], answers: Pick<LeadAnswer, "question_title" | "answer_value">[]): number[] {
  const all = flatten(steps);
  return answers.map((a) => {
    const candidates = all.filter((s) => (s.config?.title ?? "").trim() === a.question_title.trim());
    for (const s of candidates) {
      const opts: QuestionOption[] = s.config?.options ?? [];
      if (s.type === "question") {
        const o = opts.find((x) => x.value === a.answer_value);
        if (o) return Number(o.score) || 0;
      }
      if (s.type === "multi_choice") {
        const values = new Set(a.answer_value.split(","));
        const chosen = opts.filter((x) => values.has(x.value));
        if (chosen.length) return chosen.reduce((sum, x) => sum + (Number(x.score) || 0), 0);
      }
      if (s.type === "rating") {
        const v = Number(a.answer_value);
        const min = s.config?.min ?? 0;
        const max = s.config?.max ?? 10;
        if (Number.isFinite(v) && v >= min && v <= max) return (s.config?.mode ?? "scale") === "scale" ? v * 2 : 0;
      }
    }
    return 0;
  });
}

export function totalFrom(scores: number[]): number {
  return Math.max(0, Math.min(100, scores.reduce((a, b) => a + b, 0)));
}

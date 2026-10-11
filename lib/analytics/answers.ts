// Perfil dos leads a partir das respostas agregadas no banco (analytics_answers).
export interface AnswerRow { question_title: string | null; answer_label: string | null; total: number }
export interface Bucket { label: string; count: number }
export interface AnswerProfile {
  gender: { female: number; male: number } | null;
  ages: Bucket[] | null;
  pains: Bucket[];
}

const GENDER_F = /^(feminino|mulher|fem(inina)?\.?|f)$/i;
const GENDER_M = /^(masculino|homem|masc(ulino)?\.?|m)$/i;
const GENDER_Q = /(sexo|g[êe]nero)/i;
const AGE_Q = /(idade|quantos anos|faixa et[áa]ria|sua idade)/i;
const AGE_LABEL = /(\d{1,2}\s*[-–a]\s*\d{1,2}|\d{2}\s*anos|\+\s*\d{2}|menos de|mais de|acima de)/i;
// Perguntas que não são "dor" (não entram no ranking de dores).
const SKIP_PAIN_Q = /(sexo|g[êe]nero|idade|quando|prazo|realizar|seu nome|whats|telefone|e-?mail|como podemos)/i;

export function summarizeAnswers(rows: AnswerRow[]): AnswerProfile {
  const gender = { female: 0, male: 0 };
  let genderSeen = false;
  const ages = new Map<string, number>();
  const pains = new Map<string, number>();

  for (const r of rows) {
    const q = r.question_title ?? "";
    const lbl = (r.answer_label ?? "").trim();
    const n = Number(r.total) || 0;
    if (!lbl || n <= 0) continue;
    if (GENDER_Q.test(q) || GENDER_F.test(lbl) || GENDER_M.test(lbl)) {
      if (GENDER_F.test(lbl)) { gender.female += n; genderSeen = true; }
      else if (GENDER_M.test(lbl)) { gender.male += n; genderSeen = true; }
      continue;
    }
    if (AGE_Q.test(q) || AGE_LABEL.test(lbl)) { ages.set(lbl, (ages.get(lbl) ?? 0) + n); continue; }
    if (SKIP_PAIN_Q.test(q)) continue;
    pains.set(lbl, (pains.get(lbl) ?? 0) + n);
  }

  const top = (m: Map<string, number>, k: number): Bucket[] =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map(([label, count]) => ({ label, count }));

  return {
    gender: genderSeen ? gender : null,
    ages: ages.size > 0 ? top(ages, 5) : null,
    pains: top(pains, 6),
  };
}

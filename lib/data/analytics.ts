import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export interface AnswerDist {
  label: string;
  count: number;
  pct: number;
}
export interface QuestionReport {
  procedure: string;
  question: string;
  options: AnswerDist[];
}

const DEMO: QuestionReport[] = [
  {
    procedure: "Rinomodelação",
    question: "O que mais incomoda?",
    options: [
      { label: "Ponta caída", count: 163, pct: 48 },
      { label: "Dorso", count: 105, pct: 31 },
      { label: "Perfil", count: 72, pct: 21 },
    ],
  },
  {
    procedure: "Rinomodelação",
    question: "Quando pretende realizar?",
    options: [
      { label: "Ainda este mês", count: 143, pct: 42 },
      { label: "O quanto antes", count: 119, pct: 35 },
      { label: "Estou pesquisando", count: 78, pct: 23 },
    ],
  },
];

export async function getAnswersReport(orgId: string): Promise<QuestionReport[]> {
  if (!isSupabaseConfigured) return DEMO;

  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_answers")
    .select("question_title, answer_label, lead_session:lead_sessions(procedure)")
    .eq("organization_id", orgId)
    .limit(5000);

  // agrupa por (procedimento + pergunta) -> contagem por opção
  const map = new Map<string, Map<string, number>>();
  const procByKey = new Map<string, string>();
  for (const row of (data as any[]) ?? []) {
    const procedure = row.lead_session?.procedure ?? "—";
    const key = `${procedure}||${row.question_title}`;
    procByKey.set(key, procedure);
    const inner = map.get(key) ?? new Map<string, number>();
    inner.set(row.answer_label, (inner.get(row.answer_label) ?? 0) + 1);
    map.set(key, inner);
  }

  const reports: QuestionReport[] = [];
  for (const [key, inner] of map) {
    const total = [...inner.values()].reduce((a, b) => a + b, 0);
    const options = [...inner.entries()]
      .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
    reports.push({
      procedure: procByKey.get(key) ?? "—",
      question: key.split("||")[1],
      options,
    });
  }
  return reports;
}

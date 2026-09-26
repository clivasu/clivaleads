import type { FlowStep } from "@/lib/types";

// Formato mínimo de lead usado para reconstruir a jornada no fluxo.
export interface JourneyLead {
  id: string;
  name?: string | null;
  whatsapp_clicked?: boolean;
  status?: string;
  answers?: { question_title: string }[];
}

export interface LeadJourney {
  id: string;
  name: string;
  path: number[];     // índices de etapa percorridos, em ordem (0..stop)
  stop: number;       // índice da etapa onde parou
  completed: boolean; // chegou ao fim (clicou no WhatsApp / converteu)
}

export interface StepJourneyStat {
  reached: number;                       // quantos chegaram nesta etapa
  exits: { id: string; name: string }[]; // quem parou aqui (sem completar)
  completed: { id: string; name: string }[]; // quem completou o funil aqui (etapa final)
  dropPct: number;
  returns: number;
  time: number;
}

export interface FlowMetrics {
  total: number;
  completed: number;
  interactionPct: number;
  perStep: StepJourneyStat[];
  worstExit: { i: number; exit: number; dropPct: number } | null;
}

const COMPLETED_STATUS = new Set(["whatsapp", "scheduled", "converted"]);

function firstName(name?: string | null): string {
  const t = (name ?? "").trim();
  if (!t) return "Anônimo";
  return t.split(/\s+/)[0];
}

// Índices das etapas que são perguntas (question / multi_choice) com título.
function questionSteps(steps: FlowStep[]): { i: number; title: string }[] {
  return steps
    .map((s, i) => ({ i, title: (s.config?.title ?? "").trim().toLowerCase() }))
    .filter((s) => (steps[s.i].type === "question" || steps[s.i].type === "multi_choice") && s.title.length > 0);
}

// Reconstrói a jornada de cada lead a partir das respostas capturadas.
export function buildJourneys(steps: FlowStep[], leads: JourneyLead[]): LeadJourney[] {
  if (steps.length === 0) return [];
  const lastIdx = steps.length - 1;
  const qSteps = questionSteps(steps);

  return leads.map((lead) => {
    const answered = new Set((lead.answers ?? []).map((a) => a.question_title.trim().toLowerCase()));
    // Última pergunta respondida → até onde o lead avançou.
    let lastAnswered = -1;
    for (const q of qSteps) if (answered.has(q.title)) lastAnswered = Math.max(lastAnswered, q.i);

    const completed = Boolean(lead.whatsapp_clicked) || COMPLETED_STATUS.has(lead.status ?? "");

    let stop: number;
    if (completed) {
      stop = lastIdx;
    } else if (lastAnswered >= 0) {
      // Parou na etapa logo após a última resposta (onde deixou de responder).
      stop = Math.min(lastAnswered + 1, lastIdx);
    } else {
      stop = 0; // iniciou e não respondeu nada
    }

    const path = Array.from({ length: stop + 1 }, (_, k) => k);
    return { id: lead.id, name: firstName(lead.name), path, stop, completed };
  });
}

// Tempo médio estimado (s) por tipo — usado só para o card "mais demorou".
const TIM: Partial<Record<string, number>> = {
  text: 22, news: 26, video: 30, question: 9, multi_choice: 11, rating: 12, form: 25, loading: 3,
  before_after: 14, carousel: 16, faq: 18, hero: 8, timer: 15, stats: 12, testimonial: 16,
};

export function computeFlowMetrics(steps: FlowStep[], leads: JourneyLead[]): FlowMetrics {
  const journeys = buildJourneys(steps, leads);
  const total = journeys.length;

  const perStep: StepJourneyStat[] = steps.map((s, i) => {
    const reached = journeys.filter((j) => j.stop >= i).length;
    const stoppedHere = journeys.filter((j) => j.stop === i);
    const exits = stoppedHere.filter((j) => !j.completed).map((j) => ({ id: j.id, name: j.name }));
    const completed = stoppedHere.filter((j) => j.completed).map((j) => ({ id: j.id, name: j.name }));
    return {
      reached,
      exits,
      completed,
      dropPct: reached ? Math.round((exits.length / reached) * 100) : 0,
      returns: 0,
      time: TIM[s.type] ?? 10,
    };
  });

  const completedTotal = journeys.filter((j) => j.completed).length;
  // "Interagiram" = passaram da primeira etapa.
  const interacted = total > 0 ? journeys.filter((j) => j.stop >= 1).length : 0;
  const interactionPct = total > 0 ? Math.round((interacted / total) * 100) : 0;

  let worstExit: FlowMetrics["worstExit"] = null;
  perStep.forEach((st, i) => {
    if (st.exits.length > 0 && (!worstExit || st.exits.length > worstExit.exit)) {
      worstExit = { i, exit: st.exits.length, dropPct: st.dropPct };
    }
  });

  return { total, completed: completedTotal, interactionPct, perStep, worstExit };
}

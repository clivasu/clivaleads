import type { FlowStep, PublicFlow, QuestionOption, StepConfig, StepType } from "@/lib/types";
import { demoOrg } from "@/lib/demo-data";
import { EXIT_DEFAULTS, GOTO_EXIT } from "@/lib/flow-logic";

// Modelos prontos por especialidade. As imagens ficam em public/templates/<key>/.
// Antes/depois são ilustrativos (gerados por IA): a clínica deve trocar por
// fotos reais, com autorização do paciente.

export type SpecialtyKey = "fono" | "nutri" | "medico" | "estetica" | "enfermagem" | "fisio" | "psico";

interface SpecialtySpec {
  key: SpecialtyKey;
  specialty: string;   // rótulo da galeria
  name: string;        // nome do funil criado
  procedure: string;
  description: string;
  accent: string;
  hero: { title: string; subtitle: string; button: string };
  goal: { title: string; options: [string, string, string, string]; emojis: [string, string, string, string] };
  pains: { title: string; options: string[] };
  rating: { title: string; low: string; high: string };
  beforeAfter?: { title: string; caption: string };
  testimonial?: { quote: string; author: string; role: string };
  chart: { axis: [string, string, string, string]; callout: string; warning: string; message: string };
  interest: { title: string; yes: string; soon: string };
  whatsapp: { title: string; body: string; button: string };
  exitBody: string;
  final_message: string;
}

const ILLUSTRATIVE = "Imagem ilustrativa. Use fotos reais com autorização do paciente.";

export const SPECIALTIES: SpecialtySpec[] = [
  {
    key: "fono",
    specialty: "Fonoaudiologia",
    name: "Fonoaudiologia: Avaliação de respiração e fala",
    procedure: "Terapia miofuncional",
    description: "Descobre se o paciente tem sinais de respiração oral, alteração de fala ou deglutição.",
    accent: "#0ea5e9",
    hero: {
      title: "Você respira pela boca ou sente a fala travar?",
      subtitle: "Faça a avaliação gratuita e descubra se a terapia fonoaudiológica é indicada para você.",
      button: "Começar avaliação",
    },
    goal: {
      title: "O que mais te incomoda hoje?",
      options: ["Respiração pela boca", "Ronco ou sono agitado", "Dificuldade na fala", "Voz cansada ou rouca"],
      emojis: ["😮‍💨", "😴", "🗣️", "🎙️"],
    },
    pains: {
      title: "Você percebe algum destes sinais?",
      options: ["Boca entreaberta em repouso", "Acorda cansado(a)", "Engasga com frequência", "Troca ou omite sons", "Dor na mandíbula"],
    },
    rating: { title: "O quanto isso atrapalha a sua rotina?", low: "Pouco", high: "Muito" },
    beforeAfter: { title: "Respiração e postura oral reeducadas", caption: ILLUSTRATIVE },
    chart: {
      axis: ["0%", "Sinais leves", "> 75%", "100%"],
      callout: "**Atenção:** a função ideal de **respiração nasal** começa a partir de 75%",
      warning: "⭕ **Respiração oral prolongada:** pode afetar sono, postura e até a arcada dentária.",
      message: "A boa notícia é que exercícios miofuncionais costumam trazer evolução já nas primeiras semanas.",
    },
    interest: { title: "Você gostaria de agendar uma avaliação com a fono?", yes: "Sim, quero agendar", soon: "Quero saber valores primeiro" },
    whatsapp: { title: "Sua avaliação está pronta", body: "Envie suas respostas para a fonoaudióloga e receba a orientação ideal.", button: "Falar com a fono no WhatsApp" },
    exitBody: "Tudo bem! Se os sinais continuarem, volte por aqui. Uma avaliação precoce faz toda a diferença.",
    final_message: "Gostaria de agendar uma avaliação fonoaudiológica.",
  },
  {
    key: "nutri",
    specialty: "Nutrição",
    name: "Nutrição: Plano alimentar personalizado",
    procedure: "Consulta nutricional",
    description: "Qualifica quem quer emagrecer, ganhar massa ou melhorar exames com acompanhamento.",
    accent: "#16a34a",
    hero: {
      title: "Descubra o plano alimentar ideal para o seu corpo",
      subtitle: "Responda em 1 minuto e veja quanto você pode evoluir com acompanhamento nutricional.",
      button: "Quero descobrir",
    },
    goal: {
      title: "Qual é o seu principal objetivo?",
      options: ["Emagrecer", "Ganhar massa magra", "Melhorar exames", "Ter mais disposição"],
      emojis: ["⚖️", "💪", "🩺", "⚡"],
    },
    pains: {
      title: "O que mais dificulta hoje?",
      options: ["Ansiedade e beliscos", "Falta de tempo para cozinhar", "Efeito sanfona", "Inchaço", "Não sei o que comer"],
    },
    rating: { title: "Quanto o seu peso afeta a sua autoestima?", low: "Nada", high: "Muito" },
    beforeAfter: { title: "Evolução com acompanhamento", caption: ILLUSTRATIVE },
    chart: {
      axis: ["0%", "Precisa ajustar", "> 75%", "100%"],
      callout: "**Atenção:** o nível ideal de **hábitos alimentares** é a partir de 75%",
      warning: "⭕ **Dietas sem orientação:** aumentam o risco de efeito sanfona e perda de massa magra.",
      message: "Com um plano feito para a sua rotina, o resultado vem sem passar fome.",
    },
    interest: { title: "Você quer começar o seu acompanhamento nutricional?", yes: "Sim, quero começar", soon: "Quero entender como funciona" },
    whatsapp: { title: "Seu perfil está pronto", body: "Envie para a nutricionista e receba o próximo passo do seu plano.", button: "Falar com a nutri no WhatsApp" },
    exitBody: "Sem problema! Quando quiser cuidar da alimentação com orientação, é só voltar por aqui.",
    final_message: "Quero começar meu acompanhamento nutricional.",
  },
  {
    key: "medico",
    specialty: "Medicina",
    name: "Médico: Avaliação de queda capilar",
    procedure: "Tratamento capilar",
    description: "Triagem para tricologia e tratamento da queda de cabelo, com qualificação de interesse.",
    accent: "#2563eb",
    hero: {
      title: "Seu cabelo está mais ralo do que antes?",
      subtitle: "Faça a triagem médica online e descubra o tratamento indicado para o seu caso.",
      button: "Fazer triagem",
    },
    goal: {
      title: "Onde você percebe mais a queda?",
      options: ["Topo da cabeça", "Entradas", "Queda no geral", "Barba ou sobrancelha"],
      emojis: ["🧑‍🦲", "📐", "🪮", "🧔"],
    },
    pains: {
      title: "Algum destes fatores faz parte da sua vida?",
      options: ["Histórico na família", "Estresse alto", "Alterações hormonais", "Dieta restritiva", "Uso de químicas"],
    },
    rating: { title: "Quanto a queda te preocupa hoje?", low: "Pouco", high: "Muito" },
    beforeAfter: { title: "Densidade capilar com tratamento", caption: ILLUSTRATIVE },
    chart: {
      axis: ["0%", "Queda ativa", "> 75%", "100%"],
      callout: "**Atenção:** a densidade ideal dos **fios** é a partir de 75%",
      warning: "⭕ **Adiar o tratamento:** folículos inativos por muito tempo podem não voltar a crescer.",
      message: "Quanto antes o diagnóstico, maior a chance de recuperar os fios.",
    },
    interest: { title: "Você gostaria de agendar uma consulta médica?", yes: "Sim, quero agendar", soon: "Quero saber valores primeiro" },
    whatsapp: { title: "Sua triagem está pronta", body: "Envie suas respostas para a equipe médica e agende a sua consulta.", button: "Agendar consulta no WhatsApp" },
    exitBody: "Tudo bem! Se a queda aumentar, volte por aqui. Diagnóstico cedo faz diferença.",
    final_message: "Gostaria de agendar uma consulta sobre queda capilar.",
  },
  {
    key: "estetica",
    specialty: "Estética",
    name: "Estética: Diagnóstico de pele",
    procedure: "Tratamento de manchas",
    description: "Diagnóstico de manchas, melasma e textura de pele com indicação de protocolo.",
    accent: "#db2777",
    hero: {
      title: "Descubra o protocolo ideal para a sua pele",
      subtitle: "Responda o diagnóstico rápido e receba a indicação para manchas, poros e textura.",
      button: "Fazer diagnóstico",
    },
    goal: {
      title: "O que você mais quer melhorar na pele?",
      options: ["Manchas e melasma", "Acne e oleosidade", "Linhas finas", "Poros e textura"],
      emojis: ["🌗", "💧", "✨", "🔍"],
    },
    pains: {
      title: "Como está a sua rotina de cuidados?",
      options: ["Não uso protetor todo dia", "Uso só sabonete", "Já fiz tratamento antes", "Pele sensível", "Durmo de maquiagem às vezes"],
    },
    rating: { title: "O quanto isso afeta a sua autoestima?", low: "Pouco", high: "Muito" },
    beforeAfter: { title: "Pele uniforme e iluminada", caption: ILLUSTRATIVE },
    chart: {
      axis: ["0%", "Pele desequilibrada", "> 75%", "100%"],
      callout: "**Atenção:** o nível ideal de **saúde da pele** é a partir de 75%",
      warning: "⭕ **Manchas sem tratamento:** tendem a escurecer com o sol e o tempo.",
      message: "Com o protocolo certo, a pele responde em poucas sessões.",
    },
    interest: { title: "Você quer agendar a sua avaliação de pele?", yes: "Sim, quero agendar", soon: "Quero saber valores primeiro" },
    whatsapp: { title: "Seu diagnóstico está pronto", body: "Envie para a esteticista e receba o protocolo indicado para você.", button: "Falar com a esteticista" },
    exitBody: "Sem problema! Quando quiser cuidar da sua pele, volte por aqui. Use protetor solar todos os dias. 💗",
    final_message: "Quero agendar minha avaliação de pele.",
  },
  {
    key: "enfermagem",
    specialty: "Enfermagem",
    name: "Enfermagem estética: Cicatrizes de acne",
    procedure: "Microagulhamento",
    description: "Qualifica pacientes com cicatrizes de acne e textura irregular para microagulhamento.",
    accent: "#0d9488",
    hero: {
      title: "Cicatrizes de acne têm tratamento",
      subtitle: "Descubra em 1 minuto se o microagulhamento é indicado para a sua pele.",
      button: "Descobrir agora",
    },
    goal: {
      title: "O que mais te incomoda na pele?",
      options: ["Cicatrizes de acne", "Poros dilatados", "Estrias", "Pele sem viço"],
      emojis: ["🌑", "🔍", "〰️", "🌿"],
    },
    pains: {
      title: "Você já tentou algum destes?",
      options: ["Ácidos em casa", "Peeling", "Laser", "Cremes de farmácia", "Nunca tratei"],
    },
    rating: { title: "Quanto as marcas te incomodam?", low: "Pouco", high: "Muito" },
    beforeAfter: { title: "Textura mais lisa após as sessões", caption: ILLUSTRATIVE },
    chart: {
      axis: ["0%", "Textura irregular", "> 75%", "100%"],
      callout: "**Atenção:** a **regeneração** ideal da pele começa a partir de 75%",
      warning: "⭕ **Cicatrizes antigas:** pedem estímulo de colágeno, cremes sozinhos não alcançam.",
      message: "O microagulhamento estimula colágeno novo e melhora a textura sessão após sessão.",
    },
    interest: { title: "Você quer agendar a sua avaliação?", yes: "Sim, quero agendar", soon: "Quero saber valores primeiro" },
    whatsapp: { title: "Sua avaliação está pronta", body: "Envie suas respostas para a enfermeira e receba o plano de sessões.", button: "Falar com a enfermeira" },
    exitBody: "Tudo bem! Quando quiser tratar as marcas, é só voltar por aqui.",
    final_message: "Quero agendar uma avaliação para microagulhamento.",
  },
  {
    key: "fisio",
    specialty: "Fisioterapia",
    name: "Fisioterapia: Dor nas costas e postura",
    procedure: "Fisioterapia postural",
    description: "Triagem de dor lombar, cervical e postura com qualificação para sessões.",
    accent: "#059669",
    hero: {
      title: "Dor nas costas não precisa ser normal",
      subtitle: "Faça a triagem gratuita e descubra o tratamento ideal para a sua dor.",
      button: "Começar triagem",
    },
    goal: {
      title: "Onde você sente mais dor?",
      options: ["Lombar", "Pescoço e ombros", "Joelhos", "Postura em geral"],
      emojis: ["🦴", "🙆", "🦵", "🧍"],
    },
    pains: {
      title: "Quando a dor aparece?",
      options: ["Ao acordar", "Sentado(a) muito tempo", "Depois de treinar", "Ao carregar peso", "O dia todo"],
    },
    rating: { title: "Qual a intensidade da sua dor?", low: "Leve", high: "Forte" },
    beforeAfter: { title: "Postura realinhada", caption: ILLUSTRATIVE },
    chart: {
      axis: ["0%", "Dor ativa", "> 75%", "100%"],
      callout: "**Atenção:** a **mobilidade** ideal começa a partir de 75%",
      warning: "⭕ **Dor crônica sem tratamento:** gera compensações que espalham a dor.",
      message: "Com terapia manual e exercícios guiados, a maioria sente alívio nas primeiras sessões.",
    },
    interest: { title: "Você quer agendar uma avaliação de fisioterapia?", yes: "Sim, quero agendar", soon: "Quero saber valores primeiro" },
    whatsapp: { title: "Sua triagem está pronta", body: "Envie suas respostas para o fisioterapeuta e agende a avaliação.", button: "Falar com o fisio no WhatsApp" },
    exitBody: "Tudo bem! Se a dor persistir, volte por aqui. Seu corpo agradece.",
    final_message: "Gostaria de agendar uma avaliação de fisioterapia.",
  },
  {
    key: "psico",
    specialty: "Psicologia",
    name: "Psicologia: Primeira conversa",
    procedure: "Psicoterapia",
    description: "Acolhimento inicial para ansiedade, estresse e relacionamentos, sem promessa de resultado.",
    accent: "#7c3aed",
    hero: {
      title: "Você não precisa passar por isso sozinho(a)",
      subtitle: "Responda algumas perguntas e dê o primeiro passo para cuidar da sua saúde emocional.",
      button: "Começar",
    },
    goal: {
      title: "O que te trouxe até aqui?",
      options: ["Ansiedade", "Estresse e cansaço", "Relacionamentos", "Autoconhecimento"],
      emojis: ["🌀", "😮‍💨", "💞", "🌱"],
    },
    pains: {
      title: "Você tem sentido algum destes?",
      options: ["Dificuldade para dormir", "Pensamentos acelerados", "Irritação frequente", "Desânimo", "Sensação de sobrecarga"],
    },
    rating: { title: "O quanto isso tem afetado o seu dia a dia?", low: "Pouco", high: "Muito" },
    testimonial: {
      quote: "Eu adiei por anos. A primeira conversa já trouxe um alívio que eu não sentia há muito tempo.",
      author: "Paciente em acompanhamento",
      role: "Psicoterapia",
    },
    chart: {
      axis: ["0%", "Sobrecarga", "> 75%", "100%"],
      callout: "**Importante:** cuidar da mente é tão necessário quanto cuidar do corpo",
      warning: "⭕ **Sinais ignorados:** costumam se acumular e pesar mais com o tempo.",
      message: "Buscar ajuda é um passo de coragem. O processo respeita o seu ritmo.",
    },
    interest: { title: "Você gostaria de agendar uma primeira conversa?", yes: "Sim, quero agendar", soon: "Quero entender como funciona" },
    whatsapp: { title: "Obrigado por compartilhar", body: "Envie suas respostas com sigilo e combine o melhor horário para a primeira conversa.", button: "Falar com a psicóloga" },
    exitBody: "Tudo bem. Quando se sentir pronto(a), é só voltar por aqui. Em caso de crise, ligue 188 (CVV), 24 horas.",
    final_message: "Gostaria de agendar uma primeira conversa.",
  },
];

const slugify = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function opt(label: string, score: number, extra: Partial<QuestionOption> = {}): QuestionOption {
  return { label, value: slugify(label), score, ...extra };
}

// Monta as etapas de um modelo. Os ids são estáveis para o `goto` funcionar.
export function buildSpecialtySteps(spec: SpecialtySpec, flowId = ""): FlowStep[] {
  const img = (f: string) => `/templates/${spec.key}/${f}.webp`;
  const list: [string, StepType, StepConfig][] = [
    ["hero", "hero", {
      title: spec.hero.title,
      subtitle: spec.hero.subtitle,
      button_label: spec.hero.button,
      image_url: img("cover"),
      overlay_color: "#0b1220",
      overlay_opacity: 55,
      overlay_dir: "bottom",
      hero_height: "md",
      text_align: "left",
      text_light: true,
    }],
    ["goal", "question", {
      key: "objetivo",
      title: spec.goal.title,
      options: spec.goal.options.map((l, i) => opt(l, 15, { emoji: spec.goal.emojis[i], phrase: `Meu foco é: ${l.toLowerCase()}.` })),
    }],
    ["pains", "multi_choice", {
      key: "sinais",
      title: spec.pains.title,
      subtitle: "Pode escolher mais de uma opção.",
      min_select: 1,
      options: spec.pains.options.map((l) => opt(l, 8, { phrase: l + "." })),
    }],
    ["impact", "rating", {
      key: "impacto",
      title: spec.rating.title,
      subtitle: "Sendo 0 nada e 10 muito.",
      mode: "scale", min: 0, max: 10, low_label: spec.rating.low, high_label: spec.rating.high,
    }],
  ];

  if (spec.beforeAfter) {
    list.push(["proof", "before_after", {
      title: spec.beforeAfter.title,
      before_url: img("before"),
      after_url: img("after"),
      caption: spec.beforeAfter.caption,
    }]);
  } else if (spec.testimonial) {
    list.push(["proof", "testimonial", { quote: spec.testimonial.quote, author: spec.testimonial.author, role: spec.testimonial.role }]);
  }

  list.push(
    ["loading", "loading", {
      messages: ["Analisando suas respostas...", "Cruzando com casos parecidos...", "Montando o seu diagnóstico..."],
      duration_ms: 2600,
    }],
    ["chart", "chart_growth", {
      title: "Seu diagnóstico está pronto",
      growth_style: "curve",
      chart_you_value: 33,
      chart_ideal_value: 75,
      chart_you_text: "VOCÊ",
      chart_ideal_text: "IDEAL",
      chart_axis_labels: spec.chart.axis,
      chart_callout: spec.chart.callout,
      chart_warning: spec.chart.warning,
      chart_message: spec.chart.message,
      chart_accent: spec.accent,
      chart_speed: 4,
      chart_live: true,
      chart_loop: false,
    }],
    ["interest", "question", {
      key: "interesse",
      title: spec.interest.title,
      options: [
        opt(spec.interest.yes, 30, { emoji: "✅", phrase: "Quero agendar o quanto antes." }),
        opt(spec.interest.soon, 15, { emoji: "💬", phrase: "Antes, gostaria de entender valores e como funciona." }),
        opt("Não tenho interesse agora", 0, { emoji: "🙅", goto: GOTO_EXIT }),
      ],
    }],
    ["form", "form", {
      title: "Falta pouco!",
      subtitle: "Preencha para receber o seu resultado pelo WhatsApp.",
      fields: [
        { name: "name", label: "Seu nome", type: "text", required: true, placeholder: "Como podemos te chamar?" },
        { name: "phone", label: "WhatsApp", type: "tel", required: true, placeholder: "(00) 00000-0000" },
      ],
      consent: "Ao continuar, você concorda em ser contatado(a). Seus dados estão protegidos (LGPD).",
    }],
    ["whatsapp", "whatsapp", { title: spec.whatsapp.title, body: spec.whatsapp.body, button_label: spec.whatsapp.button }],
    ["exit", "exit", { ...EXIT_DEFAULTS, body: spec.exitBody }],
  );

  return list.map(([id, type, config], position) => ({
    id: `${spec.key}-${id}`,
    flow_id: flowId,
    position,
    type,
    config,
  }));
}

export function getSpecialty(key: string): SpecialtySpec | undefined {
  return SPECIALTIES.find((s) => s.key === key);
}

// Versão pública (demo e landing), usando a clínica de demonstração.
export const specialtyFlows: PublicFlow[] = SPECIALTIES.map((spec, i) => {
  const id = `33333333-0000-0000-0000-${String(i + 1).padStart(12, "0")}`;
  return {
    id,
    organization_id: demoOrg.id,
    name: spec.name,
    slug: `modelo-${spec.key}`,
    procedure: spec.procedure,
    description: spec.description,
    cover_image_url: `/templates/${spec.key}/cover.webp`,
    status: "published",
    whatsapp_number: demoOrg.whatsapp_number,
    final_message: spec.final_message,
    created_at: "2026-10-05T00:00:00Z",
    updated_at: "2026-10-05T00:00:00Z",
    organization: demoOrg,
    steps: buildSpecialtySteps(spec, id),
  };
});

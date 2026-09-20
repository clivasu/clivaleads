import type { Organization, PublicFlow } from "@/lib/types";

// Espelho do supabase/seed.sql. Usado APENAS quando o Supabase ainda não está
// conectado, para permitir testar o funil público + WhatsApp localmente.
// Assim que você conectar o Supabase, a app passa a ler do banco real.

export const demoOrg: Organization = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Clínica Demo",
  slug: "clinica-demo",
  logo_url: null,
  primary_color: "#7C3AED",
  whatsapp_number: "5561999999999",
  default_message: "Fico no aguardo, obrigado!",
  instagram: "@clinicademo",
};

export const demoFlows: PublicFlow[] = [
  {
    id: "22222222-0000-0000-0000-000000000012",
    organization_id: demoOrg.id,
    name: "Roleta Promocional",
    slug: "roleta-clinica-demo",
    procedure: "Harmonização Facial",
    description: "Gamificação: gire a roleta e concorra a prêmios.",
    cover_image_url: null,
    status: "published",
    whatsapp_number: "5561999999999",
    final_message: "Quero resgatar meu prêmio!",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    organization: demoOrg,
    steps: [
      { id: "r0", flow_id: "22222222-0000-0000-0000-000000000012", position: 0, type: "spin_wheel", config: {
        title: "Roleta Promocional",
        subtitle: "Gire a roleta e concorra a prêmios incríveis!",
        spin_enabled: true,
        button_label: "GIRE!",
        result_prefix: "Você ganhou:",
        cta_label: "Resgatar no WhatsApp",
        retry_label: "Girar novamente",
        max_attempts: 3,
        // 1ª tentativa: nada · 2ª: brinde · 3ª: o prêmio principal
        attempt_outcomes: [2, 6, 7],
        wheel_bg: "#1e3a8a",
        wheel_color_a: "#f59e0b",
        wheel_color_b: "#1d4ed8",
        wheel_ring: "#d4a017",
        wheel_accent: "#ffcf3f",
        wheel_segments: [
          { label: "Prêmio!" }, { label: "Super desconto!" }, { label: "Não foi dessa vez" },
          { label: "Super desconto!" }, { label: "Cupom desconto!" }, { label: "Não foi dessa vez" },
          { label: "Brinde grátis!" }, { label: "Super grátis!" },
        ],
      }},
      { id: "r1", flow_id: "22222222-0000-0000-0000-000000000012", position: 1, type: "whatsapp", config: {
        title: "Boa sorte!",
        body: "Fale com a nossa equipe para resgatar o seu prêmio.",
        button_label: "Falar no WhatsApp",
      }},
    ],
  },
  {
    id: "22222222-0000-0000-0000-000000000010",
    organization_id: demoOrg.id,
    name: "Harmonização Facial — Avaliação",
    slug: "harmonizacao-facial-clinica-demo",
    procedure: "Harmonização Facial",
    description: "Avaliação interativa completa para descobrir a indicação ideal.",
    cover_image_url: null,
    status: "published",
    whatsapp_number: "5561999999999",
    final_message: "Quando podemos conversar?",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    organization: demoOrg,
    steps: [
      { id: "h0", flow_id: "22222222-0000-0000-0000-000000000010", position: 0, type: "start", config: {
        title: "Descubra se a Harmonização Facial é indicada para você",
        subtitle: "Responda algumas perguntas rápidas e receba uma recomendação personalizada.",
        image_url: "https://placehold.co/600x300/DDD6FE/5B21B6/png?text=Harmonizacao+Facial",
        duration_label: "Leva 2 minutos",
        button_label: "Começar avaliação",
      }},
      { id: "h1", flow_id: "22222222-0000-0000-0000-000000000010", position: 1, type: "alert", config: {
        body: "Esta avaliação é gratuita e não substitui uma consulta médica presencial.",
        variant: "info",
      }},
      { id: "h2", flow_id: "22222222-0000-0000-0000-000000000010", position: 2, type: "question", config: {
        key: "objetivo",
        title: "O que você mais gostaria de melhorar?",
        options: [
          { label: "Contorno do rosto", value: "contorno", emoji: "💎", score: 15, phrase: "Quero melhorar o contorno do rosto." },
          { label: "Lábios", value: "labios", emoji: "💋", score: 15, phrase: "Tenho interesse em harmonizar os lábios." },
          { label: "Olheiras", value: "olheiras", emoji: "😴", score: 15, phrase: "Me incomodam as olheiras." },
          { label: "Papada / queixo", value: "papada", emoji: "🧑", score: 15, phrase: "Gostaria de trabalhar a papada e o queixo." },
        ],
      }},
      { id: "h3", flow_id: "22222222-0000-0000-0000-000000000010", position: 3, type: "multi_choice", config: {
        key: "incomodos",
        title: "Quais incômodos você sente hoje?",
        subtitle: "Pode escolher mais de uma opção.",
        min_select: 1,
        options: [
          { label: "Flacidez", value: "flacidez", score: 10, phrase: "Sinto flacidez." },
          { label: "Linhas finas", value: "linhas", score: 10, phrase: "Tenho linhas finas." },
          { label: "Assimetria", value: "assimetria", score: 10, phrase: "Percebo assimetria." },
          { label: "Perda de volume", value: "volume", score: 10, phrase: "Sinto perda de volume." },
        ],
      }},
      { id: "h4", flow_id: "22222222-0000-0000-0000-000000000010", position: 4, type: "rating", config: {
        key: "autoestima",
        title: "O quanto isso afeta a sua autoestima?",
        subtitle: "Sendo 0 nada e 10 muito.",
        mode: "scale", min: 0, max: 10, low_label: "Pouco", high_label: "Muito",
      }},
      { id: "h5", flow_id: "22222222-0000-0000-0000-000000000010", position: 5, type: "before_after", config: {
        title: "Resultados reais",
        before_url: "https://placehold.co/400x400/E2E8F0/475569/png?text=Antes",
        after_url: "https://placehold.co/400x400/DDD6FE/5B21B6/png?text=Depois",
        caption: "Resultados podem variar conforme avaliação profissional.",
      }},
      { id: "h6", flow_id: "22222222-0000-0000-0000-000000000010", position: 6, type: "stats", config: {
        title: "Por que a Clínica Demo",
        stats: [
          { value: "+3.500", label: "procedimentos" },
          { value: "4.9★", label: "avaliação" },
          { value: "12 anos", label: "de experiência" },
        ],
      }},
      { id: "h7", flow_id: "22222222-0000-0000-0000-000000000010", position: 7, type: "testimonial", config: {
        quote: "Fui super bem acolhida e o resultado ficou muito natural. Recomendo demais!",
        author: "Juliana M.",
        role: "Harmonização facial",
      }},
      { id: "h8", flow_id: "22222222-0000-0000-0000-000000000010", position: 8, type: "question", config: {
        key: "quando",
        title: "Quando você pretende realizar?",
        options: [
          { label: "O quanto antes", value: "asap", score: 30, phrase: "Gostaria de realizar o quanto antes." },
          { label: "Ainda este mês", value: "este_mes", score: 20, phrase: "Pretendo realizar ainda este mês." },
          { label: "Estou pesquisando", value: "pesquisando", score: 5, phrase: "No momento estou pesquisando." },
        ],
      }},
      { id: "h9", flow_id: "22222222-0000-0000-0000-000000000010", position: 9, type: "loading", config: {
        messages: ["Analisando suas respostas...", "Cruzando seu perfil...", "Gerando sua recomendação..."],
        duration_ms: 2800,
      }},
      { id: "h10", flow_id: "22222222-0000-0000-0000-000000000010", position: 10, type: "level", config: {
        title: "Seu nível de indicação",
        subtitle: "Com base nas suas respostas.",
      }},
      { id: "h11", flow_id: "22222222-0000-0000-0000-000000000010", position: 11, type: "form", config: {
        title: "Falta pouco!",
        subtitle: "Preencha para liberar sua recomendação personalizada.",
        fields: [
          { name: "name", label: "Seu nome", type: "text", required: true, placeholder: "Como podemos te chamar?" },
          { name: "phone", label: "WhatsApp", type: "tel", required: true, placeholder: "(00) 00000-0000" },
        ],
        consent: "Ao continuar, você concorda em ser contatado pela clínica. Seus dados estão protegidos (LGPD).",
      }},
      { id: "h12", flow_id: "22222222-0000-0000-0000-000000000010", position: 12, type: "result", config: {
        tiers: [
          { min: 70, badge: "Forte indicação", title: "Você é um ótimo candidato!", body: "Seu perfil combina bem com a harmonização facial. Vamos montar um plano sob medida na avaliação." },
          { min: 40, badge: "Boa indicação", title: "A harmonização pode te ajudar", body: "Vários dos seus objetivos são tratáveis. Uma avaliação vai confirmar o melhor caminho." },
          { min: 0, badge: "Vale avaliar", title: "Vamos entender melhor o seu caso", body: "Com uma conversa rápida conseguimos indicar a melhor abordagem para você." },
        ],
      }},
      { id: "h13", flow_id: "22222222-0000-0000-0000-000000000010", position: 13, type: "timer", config: {
        title: "Condição especial",
        subtitle: "Avaliação com valor promocional válida por:",
        minutes: 15,
        body: "Garanta agora falando com a nossa equipe.",
      }},
      { id: "h14", flow_id: "22222222-0000-0000-0000-000000000010", position: 14, type: "faq", config: {
        title: "Perguntas frequentes",
        faqs: [
          { q: "Dói?", a: "Usamos anestésico e técnicas para o máximo conforto. O incômodo costuma ser mínimo." },
          { q: "Quanto tempo dura o resultado?", a: "Varia conforme o produto e o metabolismo, geralmente de meses a mais de um ano." },
          { q: "Fica natural?", a: "Sim, o objetivo é realçar a sua beleza com naturalidade, conforme avaliação." },
        ],
      }},
      { id: "h15", flow_id: "22222222-0000-0000-0000-000000000010", position: 15, type: "whatsapp", config: {
        title: "Pronto para conversar?",
        body: "Vamos te encaminhar para um especialista com o seu contexto.",
        button_label: "Falar com especialista no WhatsApp",
      }},
    ],
  },
  {
    id: "22222222-0000-0000-0000-000000000011",
    organization_id: demoOrg.id,
    name: "Advertorial — Notícia + Gráficos",
    slug: "advertorial-clinica-demo",
    procedure: "Harmonização Facial",
    description: "Modelos de bloco de notícia (g1 / Metrópoles) e gráficos animados.",
    cover_image_url: null,
    status: "published",
    whatsapp_number: "5561999999999",
    final_message: "Quando podemos conversar?",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    organization: demoOrg,
    steps: [
      { id: "ad0", flow_id: "22222222-0000-0000-0000-000000000011", position: 0, type: "start", config: {
        title: "Veja o que está saindo na imprensa",
        subtitle: "Histórias reais de quem já passou por isso.",
        duration_label: "1 minuto",
        button_label: "Ver matéria",
      }},
      { id: "ad1", flow_id: "22222222-0000-0000-0000-000000000011", position: 1, type: "news", config: {
        layout: "metropoles",
        kicker: "Colunas",
        source: "ETRÓPOLES",
        columnist: { name: "Fábia Oliveira", avatar_url: "https://placehold.co/100x100/EADDCA/8B5E3C/png?text=FO", role: "Colunista" },
        title: "Antes e depois: paciente mostra mudanças após procedimentos estéticos.",
        highlight_word: "Vídeo",
        subtitle: "Ela usou as redes sociais para mostrar as diferenças no rosto desde que começou os tratamentos.",
        date: "03/09/2026 10:14",
        share_links: { whatsapp: "https://wa.me/5561999999999", facebook: "https://facebook.com", twitter: "https://x.com", google: "https://google.com" },
        video_url: "https://www.youtube.com/embed/5qap5aO4i9A",
        paragraphs: [
          "Segundo especialistas, a harmonização facial cresceu de forma expressiva nos últimos anos, com foco em resultados naturais.",
          "O procedimento, quando bem indicado, realça traços e devolve autoestima, sempre a partir de avaliação profissional.",
        ],
        button_label: "Continuar",
      }},
      { id: "ad2", flow_id: "22222222-0000-0000-0000-000000000011", position: 2, type: "chart_growth", config: {
        title: "Sua evolução com o acompanhamento",
        subtitle: "Comparado a quem não faz avaliação profissional.",
        you_label: "Você",
        competitor_label: "Sem avaliação",
        x_labels: ["Antes", "Agora", "Depois"],
        you_series: [18, 48, 94],
        competitor_series: [22, 28, 32],
      }},
      { id: "ad3", flow_id: "22222222-0000-0000-0000-000000000011", position: 3, type: "news", config: {
        layout: "g1",
        kicker: "Veja esta notícia do g1!",
        source: "NEGÓCIOS",
        title: "Pacientes relatam alta satisfação após tratamentos estéticos guiados por avaliação",
        byline: "Matéria por Lívia Mendes",
        subtitle: "Ana, paciente da Clínica Demo, diz:",
        paragraphs: [
          "“Fiz a avaliação, entendi o que era indicado pra mim e o resultado ficou super natural. Me sinto muito mais confiante.”",
          "Segundo a clínica, o segredo está em planejar cada caso individualmente, sem exageros.",
        ],
        news_images: [
          "https://placehold.co/400x400/E9D5FF/6B21A8/png?text=Paciente",
          "https://placehold.co/400x400/FDE68A/92400E/png?text=Resultado",
        ],
        button_label: "Continuar",
      }},
      { id: "ad4", flow_id: "22222222-0000-0000-0000-000000000011", position: 4, type: "chart_gauge", config: {
        title: "Satisfação dos pacientes",
        subtitle: "Pesquisa interna da Clínica Demo.",
        gauge_value: 76,
        gauge_caption: "recomendam o tratamento",
      }},
      { id: "ad5", flow_id: "22222222-0000-0000-0000-000000000011", position: 5, type: "news", config: {
        layout: "metropoles",
        kicker: "Saúde",
        source: "ETRÓPOLES",
        columnist: { name: "Dra. Helena Prado", avatar_url: "https://placehold.co/100x100/DBEAFE/1E40AF/png?text=HP", role: "Dermatologista" },
        title: "Especialistas explicam por que a avaliação prévia é essencial.",
        subtitle: "Profissionais reforçam a importância da consulta antes de qualquer procedimento.",
        date: "01/09/2026 08:30",
        share_links: { whatsapp: "https://wa.me/5561999999999", facebook: "https://facebook.com", twitter: "https://x.com" },
        paragraphs: [
          "A avaliação prévia permite indicar o tratamento certo para cada pessoa e evitar resultados artificiais.",
          "É o passo que separa uma boa experiência de uma frustração, segundo os especialistas.",
        ],
        button_label: "Quero minha avaliação",
      }},
      { id: "ad6", flow_id: "22222222-0000-0000-0000-000000000011", position: 6, type: "whatsapp", config: {
        title: "Vamos conversar?",
        body: "Fale com a nossa equipe e agende sua avaliação.",
        button_label: "Falar no WhatsApp",
      }},
    ],
  },
  {
    id: "22222222-0000-0000-0000-000000000001",
    organization_id: demoOrg.id,
    name: "Rinomodelação — Clínica Demo",
    slug: "rinomodelacao-clinica-demo",
    procedure: "Rinomodelação",
    description: "Melhore o perfil do nariz sem cirurgia, com avaliação profissional.",
    cover_image_url: null,
    status: "published",
    whatsapp_number: "5561999999999",
    final_message: "Quando podemos conversar?",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    organization: demoOrg,
    steps: [
      {
        id: "s1", flow_id: "22222222-0000-0000-0000-000000000001", position: 0, type: "question",
        config: {
          key: "incomodo",
          title: "O que você gostaria de melhorar no seu nariz?",
          subtitle: "Escolha o que mais te incomoda hoje.",
          options: [
            { label: "Ponta caída", value: "ponta_caida", score: 15, phrase: "O que mais me incomoda é a ponta caída." },
            { label: "Dorso / elevação", value: "dorso", score: 15, phrase: "Gostaria de trabalhar o dorso do nariz." },
            { label: "Perfil", value: "perfil", score: 15, phrase: "Quero melhorar o perfil do nariz." },
          ],
        },
      },
      {
        id: "s2", flow_id: "22222222-0000-0000-0000-000000000001", position: 1, type: "before_after",
        config: {
          caption: "Resultados podem variar conforme avaliação profissional.",
          before_url: "https://placehold.co/400x400/E2E8F0/475569/png?text=Antes",
          after_url: "https://placehold.co/400x400/DDD6FE/5B21B6/png?text=Depois",
        },
      },
      {
        id: "s3", flow_id: "22222222-0000-0000-0000-000000000001", position: 2, type: "text",
        config: {
          title: "Como funciona",
          body: "A rinomodelação pode trabalhar pontos específicos do perfil do nariz, de acordo com avaliação profissional. É um procedimento rápido e sem cirurgia.",
        },
      },
      {
        id: "s4", flow_id: "22222222-0000-0000-0000-000000000001", position: 3, type: "question",
        config: {
          key: "quando",
          title: "Quando você gostaria de realizar?",
          options: [
            { label: "O quanto antes", value: "asap", score: 30, phrase: "Gostaria de realizar o quanto antes." },
            { label: "Ainda este mês", value: "este_mes", score: 20, phrase: "Pretendo realizar ainda este mês." },
            { label: "Estou apenas pesquisando", value: "pesquisando", score: 5, phrase: "No momento estou apenas pesquisando." },
          ],
        },
      },
      {
        id: "s5", flow_id: "22222222-0000-0000-0000-000000000001", position: 4, type: "question",
        config: {
          key: "ajuda",
          title: "Como podemos te ajudar agora?",
          options: [
            { label: "Quero saber se é indicado para mim", value: "indicado", score: 20, phrase: "Quero entender se o procedimento é indicado para mim." },
            { label: "Quero saber valores", value: "valores", score: 15, phrase: "Gostaria de saber os valores." },
            { label: "Quero ver horários disponíveis", value: "horarios", score: 25, phrase: "Quero ver os horários disponíveis." },
          ],
        },
      },
      {
        id: "s6", flow_id: "22222222-0000-0000-0000-000000000001", position: 5, type: "whatsapp",
        config: {
          title: "Tudo certo!",
          body: "Vamos te encaminhar para um especialista com o seu contexto.",
          button_label: "Falar com especialista no WhatsApp",
        },
      },
    ],
  },
  {
    id: "22222222-0000-0000-0000-000000000002",
    organization_id: demoOrg.id,
    name: "Botox Full Face — Clínica Demo",
    slug: "botox-full-face-clinica-demo",
    procedure: "Botox Full Face",
    description: "Suavize linhas de expressão com naturalidade.",
    cover_image_url: null,
    status: "published",
    whatsapp_number: "5561999999999",
    final_message: "Quando podemos conversar?",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    organization: demoOrg,
    steps: [
      {
        id: "b1", flow_id: "22222222-0000-0000-0000-000000000002", position: 0, type: "question",
        config: {
          key: "regiao",
          title: "Qual região mais te incomoda?",
          options: [
            { label: "Testa", value: "testa", score: 15, phrase: "O que mais me incomoda é a testa." },
            { label: "Olhos (pés de galinha)", value: "olhos", score: 15, phrase: "Me incomoda a região dos olhos." },
            { label: "Rosto todo", value: "full", score: 20, phrase: "Tenho interesse no rosto todo." },
          ],
        },
      },
      {
        id: "b2", flow_id: "22222222-0000-0000-0000-000000000002", position: 1, type: "question",
        config: {
          key: "quando",
          title: "Quando pretende realizar?",
          options: [
            { label: "O quanto antes", value: "asap", score: 30, phrase: "Gostaria de realizar o quanto antes." },
            { label: "Ainda este mês", value: "este_mes", score: 20, phrase: "Pretendo realizar ainda este mês." },
            { label: "Só pesquisando", value: "pesquisando", score: 5, phrase: "No momento estou apenas pesquisando." },
          ],
        },
      },
      {
        id: "b3", flow_id: "22222222-0000-0000-0000-000000000002", position: 2, type: "whatsapp",
        config: { button_label: "Falar no WhatsApp" },
      },
    ],
  },
  {
    id: "22222222-0000-0000-0000-000000000003",
    organization_id: demoOrg.id,
    name: "Preenchimento Labial — Clínica Demo",
    slug: "preenchimento-labial-clinica-demo",
    procedure: "Preenchimento Labial",
    description: "Volume e contorno com resultado natural.",
    cover_image_url: null,
    status: "published",
    whatsapp_number: "5561999999999",
    final_message: "Quando podemos conversar?",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    organization: demoOrg,
    steps: [
      {
        id: "p1", flow_id: "22222222-0000-0000-0000-000000000003", position: 0, type: "question",
        config: {
          key: "objetivo",
          title: "Qual é o seu objetivo?",
          options: [
            { label: "Mais volume", value: "volume", score: 15, phrase: "Meu objetivo é ganhar mais volume nos lábios." },
            { label: "Melhorar o contorno", value: "contorno", score: 15, phrase: "Quero melhorar o contorno dos lábios." },
            { label: "Hidratação / naturalidade", value: "natural", score: 10, phrase: "Busco um resultado natural e hidratado." },
          ],
        },
      },
      {
        id: "p2", flow_id: "22222222-0000-0000-0000-000000000003", position: 1, type: "question",
        config: {
          key: "ajuda",
          title: "Como podemos te ajudar?",
          options: [
            { label: "Saber se é indicado", value: "indicado", score: 20, phrase: "Quero saber se é indicado para mim." },
            { label: "Saber valores", value: "valores", score: 15, phrase: "Gostaria de saber os valores." },
            { label: "Ver horários", value: "horarios", score: 25, phrase: "Quero ver os horários disponíveis." },
          ],
        },
      },
      {
        id: "p3", flow_id: "22222222-0000-0000-0000-000000000003", position: 2, type: "whatsapp",
        config: { button_label: "Falar no WhatsApp" },
      },
    ],
  },
];

export function getDemoFlowBySlug(slug: string): PublicFlow | null {
  return demoFlows.find((f) => f.slug === slug) ?? null;
}

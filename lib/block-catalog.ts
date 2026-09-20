import type { StepType, StepConfig } from "@/lib/types";

export interface BlockDef {
  type: StepType;
  label: string;
  group: "Layout" | "Conteúdo" | "Perguntas" | "Prova" | "Conversão";
  isNew?: boolean;
}

// Paleta de blocos disponível no Construtor.
export const BLOCK_CATALOG: BlockDef[] = [
  { type: "container", label: "Seção / Grupo", group: "Layout", isNew: true },
  { type: "hero", label: "Hero (capa)", group: "Layout", isNew: true },
  { type: "start", label: "Início", group: "Conteúdo" },
  { type: "text", label: "Texto", group: "Conteúdo" },
  { type: "image", label: "Imagem", group: "Conteúdo" },
  { type: "video", label: "Vídeo", group: "Conteúdo" },
  { type: "carousel", label: "Carrossel", group: "Conteúdo" },
  { type: "before_after", label: "Antes e depois", group: "Conteúdo" },
  { type: "audio", label: "Áudio", group: "Conteúdo", isNew: true },
  { type: "alert", label: "Alerta", group: "Conteúdo" },
  { type: "news", label: "Notícia / Advertorial", group: "Conteúdo", isNew: true },

  { type: "question", label: "Escolha única", group: "Perguntas" },
  { type: "buttons", label: "Botões (personalizado)", group: "Perguntas", isNew: true },
  { type: "multi_choice", label: "Escolha múltipla", group: "Perguntas" },
  { type: "rating", label: "Avaliação / Escala", group: "Perguntas" },
  { type: "form", label: "Captura de contato", group: "Perguntas" },

  { type: "testimonial", label: "Depoimento", group: "Prova" },
  { type: "stats", label: "Prova social", group: "Prova" },
  { type: "level", label: "Nível / Gauge", group: "Prova" },
  { type: "chart_growth", label: "Gráfico crescimento", group: "Prova", isNew: true },
  { type: "chart_gauge", label: "Gráfico circular", group: "Prova", isNew: true },
  { type: "faq", label: "FAQ", group: "Prova" },

  { type: "spin_wheel", label: "Roleta (gamificação)", group: "Conversão", isNew: true },
  { type: "loading", label: "Análise (loading)", group: "Conversão" },
  { type: "timer", label: "Timer", group: "Conversão" },
  { type: "result", label: "Resultado", group: "Conversão" },
  { type: "cta", label: "CTA", group: "Conversão" },
  { type: "whatsapp", label: "WhatsApp", group: "Conversão" },
];

// Config inicial de cada bloco ao ser adicionado (para o preview não ficar vazio).
export function defaultConfig(type: StepType): StepConfig {
  switch (type) {
    case "container":
      return { title: "", container_layout: "vertical", gap: 12, columns: 2, pad: 0 };
    case "hero":
      return {
        title: "Transforme sua autoestima",
        subtitle: "Tratamentos com resultado natural e avaliação especializada.",
        button_label: "Quero minha avaliação",
        image_url: "https://picsum.photos/seed/clinic/900/700",
        overlay_color: "#0b1220",
        overlay_opacity: 60,
        overlay_dir: "bottom",
        hero_height: "md",
        text_align: "left",
        text_light: true,
      };
    case "start":
      return { title: "Título da tela inicial", subtitle: "Uma frase de apoio.", duration_label: "Leva 1 minuto", button_label: "Começar" };
    case "text":
      return { title: "Novo texto", body: "Escreva aqui o conteúdo persuasivo." };
    case "image":
      return { title: "", image_url: "https://placehold.co/600x360/E2E8F0/475569/png?text=Imagem" };
    case "video":
      return { title: "Assista", url: "https://www.youtube.com/embed/5qap5aO4i9A" };
    case "carousel":
      return { title: "Resultados", carousel_layout: "slider", items: [
        { image_url: "https://placehold.co/600x400/DDD6FE/5B21B6/png?text=1", caption: "Legenda 1" },
        { image_url: "https://placehold.co/600x400/E9D5FF/6B21A8/png?text=2", caption: "Legenda 2" },
        { image_url: "https://placehold.co/600x400/FDE68A/92400E/png?text=3", caption: "Legenda 3" },
      ] };
    case "audio":
      return { title: "Ouça a mensagem", subtitle: "Toque para reproduzir.", autoplay: false, audio_url: "" };
    case "buttons":
      return { title: "O que você prefere?", buttons_layout: "stack", size: "md", buttons: [
        { label: "Falar com especialista", variant: "solid" },
        { label: "Ver nossos resultados", variant: "outline" },
      ] };
    case "before_after":
      return { title: "Antes e depois", before_url: "https://placehold.co/400x400/E2E8F0/475569/png?text=Antes", after_url: "https://placehold.co/400x400/DDD6FE/5B21B6/png?text=Depois", caption: "Resultados podem variar." };
    case "alert":
      return { body: "Mensagem de aviso importante.", variant: "info" };
    case "news":
      return {
        layout: "metropoles", kicker: "Colunas", source: "ETRÓPOLES",
        columnist: { name: "Nome Sobrenome", avatar_url: "https://placehold.co/100x100/EADDCA/8B5E3C/png?text=NS", role: "Colunista" },
        title: "Título da notícia aqui", highlight_word: "Vídeo",
        subtitle: "Subtítulo da matéria com contexto.", date: "01/01/2026 10:00",
        share_links: { whatsapp: "", facebook: "", twitter: "" },
        video_url: "https://www.youtube.com/embed/5qap5aO4i9A",
        paragraphs: ["Primeiro parágrafo da matéria.", "Segundo parágrafo da matéria."],
        button_label: "Continuar",
      };
    case "question":
      return { title: "Sua pergunta aqui?", options: [
        { label: "Opção A", value: "a", score: 10 },
        { label: "Opção B", value: "b", score: 10 },
      ] };
    case "multi_choice":
      return { title: "Selecione uma ou mais", min_select: 1, options: [
        { label: "Opção 1", value: "1", score: 10 },
        { label: "Opção 2", value: "2", score: 10 },
        { label: "Opção 3", value: "3", score: 10 },
      ] };
    case "rating":
      return { title: "De 0 a 10, o quanto...?", mode: "scale", min: 0, max: 10, low_label: "Pouco", high_label: "Muito" };
    case "form":
      return { title: "Falta pouco!", subtitle: "Preencha para continuar.", fields: [
        { name: "name", label: "Seu nome", type: "text", required: true, placeholder: "Seu nome" },
        { name: "phone", label: "WhatsApp", type: "tel", required: true, placeholder: "(00) 00000-0000" },
      ], consent: "Seus dados estão protegidos (LGPD)." };
    case "testimonial":
      return { quote: "Escreva aqui o depoimento do paciente.", author: "Nome do paciente", role: "Procedimento", avatar_url: "https://placehold.co/80x80/DDD6FE/5B21B6/png?text=P" };
    case "stats":
      return { title: "Por que a clínica", stats: [
        { value: "+3.500", label: "procedimentos" },
        { value: "4.9★", label: "avaliação" },
        { value: "12 anos", label: "experiência" },
      ] };
    case "level":
      return { title: "Seu nível", subtitle: "Com base nas respostas.", value: 75, level_label: "Alto" };
    case "chart_growth":
      return { title: "Sua evolução", subtitle: "Comparado à média.", you_label: "Você", competitor_label: "Média", x_labels: ["Antes", "Agora", "Depois"], you_series: [18, 48, 92], competitor_series: [22, 28, 32] };
    case "chart_gauge":
      return { title: "Índice", subtitle: "Resultado da pesquisa.", gauge_value: 76, gauge_caption: "de satisfação" };
    case "faq":
      return { title: "Perguntas frequentes", faqs: [
        { q: "Pergunta 1?", a: "Resposta 1." },
        { q: "Pergunta 2?", a: "Resposta 2." },
      ] };
    case "spin_wheel":
      return {
        title: "Roleta Promocional",
        subtitle: "Gire a roleta e concorra a prêmios incríveis!",
        spin_enabled: true,
        button_label: "GIRE!",
        result_prefix: "Você ganhou:",
        cta_label: "Resgatar no WhatsApp",
        retry_label: "Girar novamente",
        max_attempts: 1,
        attempt_outcomes: [-1],
        wheel_bg: "#1e3a8a",
        wheel_color_a: "#f59e0b",
        wheel_color_b: "#1d4ed8",
        wheel_ring: "#d4a017",
        wheel_accent: "#ffcf3f",
        wheel_segments: [
          { label: "Prêmio!" }, { label: "Super desconto!" }, { label: "Cupom desconto!" },
          { label: "Super desconto!" }, { label: "Prêmio!" }, { label: "Cupom desconto!" },
          { label: "Brinde grátis!" }, { label: "Super grátis!" },
        ],
      };
    case "loading":
      return { messages: ["Analisando suas respostas...", "Montando seu perfil...", "Quase lá..."], duration_ms: 2600 };
    case "timer":
      return { title: "Condição especial", subtitle: "Válida por:", minutes: 15, body: "Garanta agora." };
    case "result":
      return { tiers: [
        { min: 60, badge: "Forte indicação", title: "Ótimo candidato!", body: "Seu perfil combina bem." },
        { min: 0, badge: "Vale avaliar", title: "Vamos entender seu caso", body: "Uma conversa rápida ajuda." },
      ] };
    case "cta":
      return { title: "Chamada para ação", body: "Texto de apoio da CTA." };
    case "whatsapp":
      return { title: "Tudo certo!", body: "Vamos te encaminhar para um especialista.", button_label: "Falar no WhatsApp" };
    default:
      return {};
  }
}

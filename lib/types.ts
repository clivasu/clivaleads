// Domain types shared across the app. These mirror the SQL schema in
// supabase/migrations/0001_init.sql. When Supabase is connected you can
// regenerate a stricter Database type with `supabase gen types`.

export type Role = "owner" | "admin" | "attendant";
export type FlowStatus = "draft" | "published";
export type LeadStatus =
  | "new"
  | "qualified"
  | "whatsapp"
  | "scheduled"
  | "converted"
  | "lost";

// Catálogo completo de blocos (inspirado na inlead, focado em saúde).
export type StepType =
  | "start" // tela inicial "Começar"
  | "question" // escolha única (Opções)
  | "multi_choice" // escolha múltipla
  | "rating" // avaliação: estrelas | escala 0-10 (dor/incômodo) | NPS
  | "text" // texto/conteúdo
  | "image" // imagem
  | "before_after" // antes e depois
  | "carousel" // carrossel de imagens/resultados
  | "testimonial" // depoimento (lista/grade/slide)
  | "video" // vídeo
  | "stats" // prova social / números
  | "alert" // aviso/alerta (prazo, aviso médico)
  | "timer" // contador de urgência
  | "loading" // "analisando seu perfil..."
  | "level" // nível/gauge de indicação
  | "faq" // perguntas frequentes (objeções)
  | "form" // captura de contato (nome/telefone/email)
  | "container" // seção/grupo que aninha outros blocos (layout personalizado)
  | "hero" // hero com imagem de fundo (papel de parede) + degradê (página de vendas)
  | "buttons" // vários botões numa etapa (modelo personalizado)
  | "audio" // player de áudio (velocidade + autoplay)
  | "news" // notícia / advertorial (g1, Metrópoles...)
  | "spin_wheel" // roleta promocional (gamificação)
  | "chart_growth" // gráfico cartesiano animado (Você vs Concorrência)
  | "chart_gauge" // gráfico circular animado (%)
  | "cta" // chamada para ação
  | "result" // resultado personalizado por score
  | "whatsapp"; // envio final para o WhatsApp

export type RatingMode = "stars" | "scale" | "nps";
export type AlertVariant = "info" | "warning" | "success";
export type NewsLayout =
  | "metropoles"
  | "g1"
  | "buzz" // BuzzNews (advertorial de negócios/copy)
  | "portalg11" // Portal G11 (advertorial estilo g1, com selo ADVERTORIAL)
  | "saude" // Ciência e Saúde (advertorial de saúde, antes/depois, palavra em destaque)
  | "atarde"; // A Tarde (jornal serifado clássico)

export interface Columnist {
  name: string;
  avatar_url?: string;
  role?: string;
}

export interface ShareLinks {
  whatsapp?: string;
  facebook?: string;
  twitter?: string;
  google?: string;
}

export type EventType =
  | "page_view"
  | "flow_started"
  | "question_viewed"
  | "option_clicked"
  | "flow_completed"
  | "whatsapp_clicked";

export type ImageStyle = "cover" | "circle";
export type ElementSize = "sm" | "md" | "lg";

export interface QuestionOption {
  label: string;
  value: string;
  score?: number;
  emoji?: string;
  image_url?: string;
  image_style?: ImageStyle; // capa em cima (cover) ou círculo no lado (circle)
  description?: string;
  href?: string; // direciona para link externo ao clicar
  // Fragmento em linguagem natural usado na mensagem do WhatsApp.
  phrase?: string;
  // Lógica condicional: índice da etapa para onde pular ao escolher.
  next?: number;
}

export interface ButtonItem {
  label: string;
  href?: string; // link externo
  next?: number; // pular para etapa
  image_url?: string;
  image_style?: ImageStyle;
  variant?: "solid" | "outline";
}

export interface FormField {
  name: string; // "name" | "phone" | "email" | "birthdate" | custom
  label: string;
  type: "text" | "email" | "tel" | "date";
  required?: boolean;
  placeholder?: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface CarouselItem {
  image_url: string;
  caption?: string;
}

export interface ResultTier {
  min: number; // pontuação mínima para este resultado
  title: string;
  body: string;
  badge?: string;
}

export interface ContactInfo {
  name?: string;
  phone?: string;
  email?: string;
}

// Shape of flow_steps.config (JSONB) por tipo de bloco. Permissivo de propósito.
export interface StepConfig {
  key?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  image_url?: string;
  button_label?: string;
  // start
  duration_label?: string;
  // question / multi_choice
  options?: QuestionOption[];
  min_select?: number;
  max_select?: number;
  option_size?: ElementSize; // tamanho dos botões de opção
  // buttons (vários botões numa etapa)
  buttons?: ButtonItem[];
  buttons_layout?: "stack" | "grid";
  size?: ElementSize; // tamanho geral (botões/blocos)
  // audio
  autoplay?: boolean;
  // hero (imagem de fundo + degradê estilo página de vendas)
  overlay_color?: string; // cor do degradê sobre a imagem
  overlay_opacity?: number; // 0-100
  overlay_dir?: "bottom" | "top" | "full" | "diagonal";
  hero_height?: "sm" | "md" | "lg";
  text_align?: "left" | "center";
  text_light?: boolean; // texto claro (sobre imagem escura)
  // container (layout aninhado)
  container_layout?: "vertical" | "horizontal" | "grid";
  gap?: number; // espaçamento entre blocos (px)
  columns?: number; // colunas quando grid
  pad?: number; // padding interno (px)
  bg?: string; // cor de fundo do container
  align?: "start" | "center" | "end";
  // rating
  mode?: RatingMode;
  min?: number;
  max?: number;
  low_label?: string;
  high_label?: string;
  // image
  url?: string;
  alt?: string;
  flush_top?: boolean; // cola a imagem na linha do cabeçalho (sem espaço)
  full_bleed?: boolean; // imagem ocupa a largura total (sem margens laterais)
  // controle do botão automático "Continuar" (evita 2 botões na mesma tela)
  hide_continue?: boolean;
  // before_after
  before_url?: string;
  after_url?: string;
  caption?: string;
  // carousel
  items?: CarouselItem[];
  carousel_layout?: "slider" | "cards" | "grid" | "list";
  // testimonial
  quote?: string;
  author?: string;
  role?: string;
  avatar_url?: string; // foto do paciente
  // stats
  stats?: StatItem[];
  // alert
  variant?: AlertVariant;
  // timer
  minutes?: number;
  // loading
  messages?: string[];
  duration_ms?: number;
  // level / gauge
  value?: number; // 0-100
  level_label?: string;
  // faq
  faqs?: FaqItem[];
  // form
  fields?: FormField[];
  consent?: string;
  // result
  tiers?: ResultTier[];
  badge?: string;
  // news / advertorial
  layout?: NewsLayout;
  kicker?: string; // "Colunas", "Veja esta notícia do g1!"
  source?: string; // "g1 NEGÓCIOS", "Metrópoles"
  columnist?: Columnist;
  byline?: string; // "Matéria por Lívia Mendes"
  date?: string; // "03/09/2026 10:14"
  section?: string; // seção do jornal ("CIÊNCIA E SAÚDE", "CREMAÇÃO")
  views?: string; // contador de visualizações (ex.: "647")
  comments?: string; // contador de comentários (ex.: "0")
  advertorial?: boolean; // mostra o selo "ADVERTORIAL"
  highlight_word?: string; // palavra em destaque no título (ex.: "Vídeo")
  paragraphs?: string[];
  news_images?: string[];
  video_url?: string;
  audio_url?: string;
  share_links?: ShareLinks;
  // chart_growth (cartesiano "Você vs Concorrência")
  you_label?: string;
  competitor_label?: string;
  x_labels?: string[];
  you_series?: number[];
  competitor_series?: number[];
  // chart_gauge (circular %)
  gauge_value?: number; // 0-100
  gauge_caption?: string;
  // spin_wheel (roleta)
  wheel_segments?: WheelSegment[];
  spin_enabled?: boolean;
  result_prefix?: string;
  cta_label?: string;
  // destino do botão final: WhatsApp automático ou link próprio
  cta_action?: "whatsapp" | "link";
  cta_href?: string; // link próprio (quando cta_action = "link")
  cta_message?: string; // mensagem personalizada do WhatsApp ({nome} e {premio} são substituídos); vazio = mensagem automática
  // roleta — lógica de ganhos
  max_attempts?: number; // nº de tentativas (giros)
  attempt_outcomes?: number[]; // índice da fatia que cai em cada tentativa (-1 = aleatório)
  retry_label?: string; // texto do botão "girar de novo"
  // roleta — cofre: borra o prêmio até a pessoa preencher os dados
  gate_enabled?: boolean;
  gate_fields?: FormField[]; // campos pedidos p/ revelar (com required por campo)
  gate_consent?: string; // texto LGPD opcional abaixo do formulário
  // roleta — cores do bloco
  wheel_bg?: string; // fundo do bloco
  wheel_color_a?: string; // cor das fatias A
  wheel_color_b?: string; // cor das fatias B
  wheel_ring?: string; // aro dourado
  wheel_accent?: string; // título / GIRE / prêmio
}

export interface WheelSegment {
  label: string;
  weight?: number; // probabilidade relativa (padrão 1)
  color?: string;
}

export interface FlowStep {
  id: string;
  flow_id: string;
  position: number;
  type: StepType;
  config: StepConfig;
  // Blocos aninhados (usado pelo bloco "container" para montar layouts).
  children?: FlowStep[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  whatsapp_number: string | null;
  default_message: string | null;
  instagram: string | null;
}

export interface Flow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  procedure: string | null;
  description: string | null;
  cover_image_url: string | null;
  status: FlowStatus;
  whatsapp_number: string | null;
  final_message: string | null;
  settings?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PublicFlow extends Flow {
  organization: Organization;
  steps: FlowStep[];
}

export interface LeadAnswer {
  question_title: string;
  answer_value: string;
  answer_label: string;
  score: number;
  phrase?: string;
}

/* ============================ LINK NA BIO ============================ */

export type BioTemplateId = "wellness" | "luxe" | "warm" | "soft";
export type BioSocialType =
  | "instagram" | "whatsapp" | "facebook" | "youtube" | "tiktok" | "linkedin" | "map" | "site" | "email";

export interface BioTheme {
  bg: string;
  text: string;
  muted: string;
  primary: string; // cor de destaque / botões
  card: string; // fundo dos botões/cards
  cardText: string; // texto dos botões
  accent: string; // detalhes
  heading: "serif" | "sans" | "script";
  buttonRadius: number;
  buttonStyle: "solid" | "glass" | "gradient" | "outline";
}

export interface BioSocial {
  type: BioSocialType;
  url: string;
}

export type BioLinkIcon =
  | "calendar" | "sparkles" | "heart" | "chat" | "map" | "instagram" | "facebook"
  | "whatsapp" | "target" | "building" | "bulb" | "star" | "gift" | "leaf" | "phone" | "link";

export interface BioLinkBlock {
  type: "link";
  label: string;
  sublabel?: string;
  url: string;
  icon?: BioLinkIcon;
  image_url?: string; // miniatura opcional (estilo card com imagem)
  highlight?: boolean;
}
export interface BioAboutBlock { type: "about"; title?: string; body?: string; image_url?: string; }
export interface BioFaqBlock { type: "faq"; title?: string; items: FaqItem[]; }
export interface BioStatsBlock { type: "stats"; items: StatItem[]; }
export interface BioHeadingBlock { type: "heading"; text: string; }

export type BioBlock = BioLinkBlock | BioAboutBlock | BioFaqBlock | BioStatsBlock | BioHeadingBlock;

export interface BioConfig {
  theme: BioTheme;
  cover_url?: string; // imagem de capa (topo)
  cover_shape?: "cover" | "circle"; // capa cheia ou avatar circular
  cover_fade?: number; // 0-100: degradê da capa fundindo no fundo do site
  cover_size?: number; // diâmetro do círculo (px) quando cover_shape = "circle"
  avatar_url?: string;
  name: string;
  tagline?: string; // frase curta
  headline?: string; // chamada em destaque
  socials: BioSocial[];
  blocks: BioBlock[];
  footer?: string;
}

export interface BioPage {
  id: string;
  organization_id: string;
  title: string | null;
  template: BioTemplateId;
  config: BioConfig;
  status: FlowStatus;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface LeadSession {
  id: string;
  session_id: string;
  flow_id: string;
  organization_id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  procedure: string | null;
  score: number;
  status: LeadStatus;
  device: string | null;
  browser: string | null;
  entry_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  whatsapp_clicked: boolean;
  created_at: string;
}

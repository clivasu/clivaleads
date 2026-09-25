import type { BioConfig, BioTemplateId } from "@/lib/types";

const AVATAR = (bg: string, fg: string) =>
  `https://placehold.co/480x600/${bg}/${fg}/png?text=Sua+foto`;

export interface BioTemplateDef {
  id: BioTemplateId;
  name: string;
  vibe: string;
  swatch: string[]; // cores para o cartão de escolha
  config: BioConfig;
}

export const BIO_TEMPLATES: Record<BioTemplateId, BioTemplateDef> = {
  wellness: {
    id: "wellness",
    name: "Wellness",
    vibe: "Clean e natural — nutrição, saúde, bem-estar",
    swatch: ["#6B7150", "#F4F0E7", "#FFFFFF"],
    config: {
      theme: { bg: "#F4F0E7", text: "#33372C", muted: "#7C7F6E", primary: "#6B7150", card: "#FFFFFF", cardText: "#33372C", accent: "#8C8F6E", heading: "serif", buttonRadius: 18, buttonStyle: "solid" },
      cover_url: AVATAR("E7E3D6", "9a9a80"),
      name: "Sofia Blake",
      tagline: "Vamos deixar o saudável simples.",
      socials: [{ type: "instagram", url: "" }, { type: "whatsapp", url: "" }],
      blocks: [
        { type: "link", label: "Nourish", sublabel: "Plano alimentar + consultoria 1:1", url: "", image_url: "https://placehold.co/200x200/DDE3CC/6B7150/png?text=%F0%9F%A5%97", highlight: true },
        { type: "link", label: "Reset", sublabel: "Reset anti-inflamatório de 7 dias", url: "", image_url: "https://placehold.co/200x200/EADFD0/8C6B4A/png?text=%F0%9F%8D%B2" },
        { type: "link", label: "Fuel", sublabel: "Acompanhamento mensal", url: "", image_url: "https://placehold.co/200x200/E7E3D6/6B7150/png?text=%F0%9F%A5%AA" },
        { type: "about", title: "Sobre mim", body: "Oi, eu sou a Sofia! Ajudo você a construir uma relação saudável com a comida — sem culpa, sem extremos. Nutrição simples, sustentável e feita pra sua rotina." },
        { type: "faq", title: "Perguntas frequentes", items: [{ q: "Como funciona a consultoria?", a: "Você preenche uma avaliação e montamos um plano 100% personalizado." }, { q: "Atende online?", a: "Sim, atendo o Brasil todo por videochamada." }] },
      ],
      footer: "Vamos redefinir o que saudável significa pra você.",
    },
  },
  luxe: {
    id: "luxe",
    name: "Luxe Dark",
    vibe: "Premium e sofisticado — beleza, estética, unhas",
    swatch: ["#0D0B09", "#C7A86A", "#EFE7DA"],
    config: {
      theme: { bg: "#0D0B09", text: "#EFE7DA", muted: "#A9A090", primary: "#C7A86A", card: "#EBDFC9", cardText: "#3A2E1E", accent: "#C7A86A", heading: "serif", buttonRadius: 16, buttonStyle: "glass" },
      cover_url: AVATAR("1c1712", "8a7a5a"),
      name: "Larissa Almeida",
      tagline: "Unhas que realçam sua beleza e elevam a sua autoestima.",
      headline: "Sua melhor versão, até nas unhas.",
      socials: [{ type: "instagram", url: "" }, { type: "whatsapp", url: "" }, { type: "map", url: "" }],
      blocks: [
        { type: "link", label: "Agendamento", sublabel: "Agende seu horário e transforme suas unhas.", url: "", icon: "calendar", highlight: true },
        { type: "link", label: "Serviços", sublabel: "Conheça todos os serviços que ofereço.", url: "", icon: "sparkles" },
        { type: "link", label: "Sobre mim", sublabel: "Saiba mais sobre minha história e trabalho.", url: "", icon: "heart" },
        { type: "link", label: "Fale conosco", sublabel: "Tire dúvidas ou faça seu pedido no WhatsApp.", url: "", icon: "chat" },
      ],
      footer: "Larissa Almeida · Beauty Designer",
    },
  },
  warm: {
    id: "warm",
    name: "Warm Coach",
    vibe: "Aconchegante e estratégico — mentoria, consultoria",
    swatch: ["#8A5A3B", "#EFE7DB", "#3A2C22"],
    config: {
      theme: { bg: "#EFE7DB", text: "#3A2C22", muted: "#6E5B4B", primary: "#8A5A3B", card: "#8A5A3B", cardText: "#FBF3E9", accent: "#A9754F", heading: "serif", buttonRadius: 16, buttonStyle: "gradient" },
      cover_url: AVATAR("E3D6C4", "9a7a5a"),
      name: "Marina Costa",
      tagline: "Especialista em desenvolvimento pessoal e estratégico.",
      socials: [{ type: "instagram", url: "" }, { type: "facebook", url: "" }, { type: "youtube", url: "" }, { type: "linkedin", url: "" }],
      blocks: [
        { type: "link", label: "Consultoria Online", url: "", icon: "target", highlight: true },
        { type: "link", label: "Método C.O.D", url: "", icon: "building" },
        { type: "link", label: "Mentoria Individual", url: "", icon: "bulb" },
        { type: "link", label: "Fale comigo", url: "", icon: "chat" },
        { type: "stats", items: [{ value: "+1000", label: "alunas" }, { value: "Desde 2021", label: "no mercado" }, { value: "96%", label: "de aprovação" }] },
        { type: "about", title: "Quem sou eu", body: "Sou a Marina, especialista em desenvolvimento pessoal e estratégico. Acompanho mulheres que desejam se reconectar com sua essência, ganhar clareza e construir uma vida com propósito." },
        { type: "faq", title: "Dúvidas", items: [{ q: "Como funciona a consultoria?", a: "Encontros online focados no seu momento e nos seus objetivos." }, { q: "Quanto tempo dura a mentoria?", a: "Programas de 3 a 6 meses, conforme seu objetivo." }] },
      ],
      footer: "Vamos criar algo incrível juntas? ♥",
    },
  },
  soft: {
    id: "soft",
    name: "Soft Pink",
    vibe: "Delicado e feminino — beleza, cílios, academy",
    swatch: ["#C97D97", "#FBF6F7", "#FFFFFF"],
    config: {
      theme: { bg: "#FBF6F7", text: "#3B2B31", muted: "#9A8790", primary: "#C97D97", card: "#FFFFFF", cardText: "#3B2B31", accent: "#D98FA8", heading: "script", buttonRadius: 999, buttonStyle: "solid" },
      cover_url: AVATAR("F3E7EC", "c98fa8"),
      name: "Camila Oliveira",
      tagline: "Bem-vinda! Toque para interagir.",
      socials: [{ type: "instagram", url: "" }, { type: "whatsapp", url: "" }, { type: "facebook", url: "" }],
      blocks: [
        { type: "link", label: "Atendimento", url: "", icon: "whatsapp", highlight: true },
        { type: "link", label: "Localização", url: "", icon: "map" },
        { type: "link", label: "Facebook", url: "", icon: "facebook" },
      ],
      footer: "Camila Oliveira · Beauty Academy",
    },
  },
};

export function defaultBioConfig(template: BioTemplateId): BioConfig {
  return structuredClone(BIO_TEMPLATES[template].config);
}

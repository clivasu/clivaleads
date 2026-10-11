// Configurações do funil (aba Configurações do editor).
// Parte vai para flows.settings (lido publicamente) e parte é privada
// (flow_private_settings): integrações e contatos internos.

export interface FunnelSettings {
  name: string; slug: string; procedure: string; description: string; status: "draft" | "published";
  whatsapp: string; finalMessage: string; redirectUrl: string; restartOnFinish: boolean; allowBack: boolean; saveProgress: boolean;
  metaPixel: string; ga4: string; gtm: string; tiktokPixel: string; headScripts: string;
  webhookUrl: string; webhookSecret: string; autoSendLead: boolean;
  seoTitle: string; seoDescription: string; ogImage: string; favicon: string; noindex: boolean;
  customDomain: string;
  notifyEmail: string; notifyWhatsapp: string; notifyOnLead: boolean;
  consentText: string; privacyUrl: string; cookieBanner: boolean;
  customCss: string;
}

export const DEFAULT_SETTINGS: FunnelSettings = {
  name: "", slug: "", procedure: "", description: "", status: "draft",
  whatsapp: "", finalMessage: "", redirectUrl: "", restartOnFinish: false, allowBack: true, saveProgress: true,
  metaPixel: "", ga4: "", gtm: "", tiktokPixel: "", headScripts: "",
  webhookUrl: "", webhookSecret: "", autoSendLead: false,
  seoTitle: "", seoDescription: "", ogImage: "", favicon: "", noindex: false,
  customDomain: "",
  notifyEmail: "", notifyWhatsapp: "", notifyOnLead: true,
  consentText: "Ao continuar, você concorda em ser contatado. Seus dados estão protegidos (LGPD).", privacyUrl: "", cookieBanner: false,
  customCss: "",
};

// Chaves privadas: nunca gravadas em flows.settings.
export const PRIVATE_KEYS = ["webhookUrl", "webhookSecret", "autoSendLead", "headScripts", "notifyEmail", "notifyWhatsapp", "notifyOnLead"] as const;

// Só aceita do JSON salvo as chaves conhecidas e do tipo certo (dados antigos
// ou corrompidos não quebram o editor).
export function pickPersistedSettings(raw: unknown): Partial<FunnelSettings> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (k in src && typeof src[k] === typeof def) out[k] = src[k];
  }
  return out as Partial<FunnelSettings>;
}

export interface PrivateSettingsRow {
  webhook_url: string | null;
  auto_send_lead: boolean;
  notify_email: string | null;
  notify_whatsapp: string | null;
  notify_on_lead: boolean | null;
  webhook_secret?: string; // só quando um novo segredo foi digitado
}

// Separa o que é público (flows.settings) do que é privado.
export function splitSettings(settings: Record<string, unknown>): { publicSettings: Record<string, unknown>; privateSettings: PrivateSettingsRow } {
  const publicSettings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings ?? {})) {
    if (!(PRIVATE_KEYS as readonly string[]).includes(k)) publicSettings[k] = v;
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const privateSettings: PrivateSettingsRow = {
    webhook_url: str(settings?.webhookUrl),
    auto_send_lead: Boolean(settings?.autoSendLead),
    notify_email: str(settings?.notifyEmail),
    notify_whatsapp: str(settings?.notifyWhatsapp),
    notify_on_lead: settings?.notifyOnLead === undefined ? null : Boolean(settings.notifyOnLead),
  };
  // Segredo: vazio = manter o atual; preenchido = trocar. Scripts livres não são aceitos.
  const secret = str(settings?.webhookSecret);
  if (secret) privateSettings.webhook_secret = secret;
  return { publicSettings, privateSettings };
}

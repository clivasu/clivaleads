// Configuração pública do funil: o que a página do paciente pode usar.
// Derivada de flows.settings no servidor, só com valores validados. Nada de
// HTML/JS livre: pixels por provedor permitido e ID no formato do provedor.

export const PIXEL_FORMATS = {
  metaPixel: { re: /^\d{8,20}$/, label: "Meta Pixel", example: "123456789012345" },
  ga4: { re: /^G-[A-Z0-9]{4,16}$/, label: "Google Analytics (GA4)", example: "G-ABC123XYZ" },
  tiktokPixel: { re: /^[A-Z0-9]{10,30}$/, label: "TikTok Pixel", example: "C1A2B3C4D5E6F7G8H9I0" },
  gtm: { re: /^GTM-[A-Z0-9]{4,12}$/, label: "Google Tag Manager", example: "GTM-ABC1234" },
} as const;
export type PixelKey = keyof typeof PIXEL_FORMATS;

// GTM executa as tags que a clínica configurar no painel do Google (scripts
// livres, que podem ler as respostas da página). Fica guardado e desligado.
export const GTM_SUPPORTED = false;

export function normalizePixelId(key: PixelKey, raw: unknown): { value: string; error?: string } {
  const v = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!v) return { value: "" };
  const up = key === "metaPixel" ? v : v.toUpperCase();
  const f = PIXEL_FORMATS[key];
  return f.re.test(up) ? { value: up } : { value: up, error: `${f.label}: ID inválido (exemplo: ${f.example}).` };
}

export function safeHttpsUrl(raw: unknown, max = 500): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.length > max) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch { return null; }
}

// Favicon: URL https ou um emoji curto.
export function safeFavicon(raw: unknown): { url: string } | { emoji: string } | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const url = safeHttpsUrl(s);
  if (url) return { url };
  if ([...s].length <= 2 && !/[<>"'&\w]/.test(s)) return { emoji: s };
  return null;
}

const clip = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

// Na gravação: corrige formatos e devolve erros legíveis para o editor.
export function normalizePublicSettings(raw: Record<string, unknown>): { settings: Record<string, unknown>; errors: string[] } {
  const out: Record<string, unknown> = { ...raw };
  const errors: string[] = [];
  for (const key of Object.keys(PIXEL_FORMATS) as PixelKey[]) {
    const r = normalizePixelId(key, raw[key]);
    out[key] = r.value;
    if (r.error) errors.push(r.error);
  }
  for (const key of ["ogImage", "privacyUrl", "redirectUrl"] as const) {
    const v = String(raw[key] ?? "").trim();
    if (v && !safeHttpsUrl(v)) errors.push(`${key === "ogImage" ? "Imagem de compartilhamento" : key === "privacyUrl" ? "Política de privacidade" : "Redirecionamento"}: use um link começando com https://`);
    out[key] = v;
  }
  const fav = String(raw.favicon ?? "").trim();
  if (fav && !safeFavicon(fav)) errors.push("Favicon: use um link https:// ou um emoji.");
  out.seoTitle = clip(raw.seoTitle, 120);
  out.seoDescription = clip(raw.seoDescription, 300);
  out.consentText = clip(raw.consentText, 400);
  return { settings: out, errors };
}

export interface PublicFunnelConfig {
  pixels: { metaPixel?: string; ga4?: string; tiktokPixel?: string };
  consent: { required: boolean; banner: boolean; text: string; privacyUrl: string | null };
  seo: { title: string | null; description: string | null; ogImage: string | null; favicon: { url: string } | { emoji: string } | null; noindex: boolean };
  redirectUrl: string | null;
}

export const EMPTY_PUBLIC_CONFIG: PublicFunnelConfig = {
  pixels: {},
  consent: { required: false, banner: false, text: "", privacyUrl: null },
  seo: { title: null, description: null, ogImage: null, favicon: null, noindex: false },
  redirectUrl: null,
};

// Na leitura (página pública): só o que é válido; o resto é ignorado.
export function toPublicConfig(raw: unknown): PublicFunnelConfig {
  if (!raw || typeof raw !== "object") return EMPTY_PUBLIC_CONFIG;
  const s = raw as Record<string, unknown>;
  const pixels: PublicFunnelConfig["pixels"] = {};
  for (const key of ["metaPixel", "ga4", "tiktokPixel"] as const) {
    const r = normalizePixelId(key, s[key]);
    if (r.value && !r.error) pixels[key] = r.value;
  }
  const hasPixels = Object.keys(pixels).length > 0;
  return {
    pixels,
    consent: {
      // Pixel de marketing só com consentimento: o banner é obrigatório.
      required: hasPixels,
      banner: hasPixels || s.cookieBanner === true,
      text: clip(s.consentText, 400),
      privacyUrl: safeHttpsUrl(s.privacyUrl),
    },
    seo: {
      title: clip(s.seoTitle, 120) || null,
      description: clip(s.seoDescription, 300) || null,
      ogImage: safeHttpsUrl(s.ogImage),
      favicon: safeFavicon(s.favicon),
      noindex: s.noindex === true,
    },
    redirectUrl: safeHttpsUrl(s.redirectUrl),
  };
}

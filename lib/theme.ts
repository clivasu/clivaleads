// Tema visual de um funil (aba Design). Aplicado ao FlowRunner via CSS vars.
// Fica em flows.settings.theme, só com o que a pessoa mudou: o resto segue a
// cor e o logo da clínica.
import { safeFileUrl } from "@/lib/funnel-form";

export type FontChoice = "sans" | "serif" | "rounded";
export type ButtonFill = "solid" | "soft";

export interface FlowTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: FontChoice;
  buttonRadius: number; // px
  buttonFill: ButtonFill;
  progressBar: boolean;
  logoUrl?: string;
}

export const DEFAULT_THEME: FlowTheme = {
  primaryColor: "#7C3AED",
  backgroundColor: "#FFFFFF",
  textColor: "#0F172A",
  fontFamily: "sans",
  buttonRadius: 12,
  buttonFill: "solid",
  progressBar: true,
};

export const FONT_STACK: Record<FontChoice, string> = {
  sans: 'var(--font-sans), system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", var(--font-sans), sans-serif',
};

// Monta as variáveis CSS a partir do tema (+ cor base como fallback).
export function themeVars(
  theme: Partial<FlowTheme> | undefined,
  fallbackPrimary?: string | null,
): React.CSSProperties {
  const t: FlowTheme = {
    ...DEFAULT_THEME,
    ...(theme ?? {}),
    primaryColor: theme?.primaryColor ?? fallbackPrimary ?? DEFAULT_THEME.primaryColor,
  };
  const soft = t.buttonFill === "soft";
  return {
    ["--brand" as string]: t.primaryColor,
    ["--btn-bg" as string]: soft
      ? `color-mix(in srgb, ${t.primaryColor} 14%, #fff)`
      : t.primaryColor,
    ["--btn-fg" as string]: soft ? t.primaryColor : "#fff",
    ["--btn-radius" as string]: `${t.buttonRadius}px`,
    ["--page-bg" as string]: t.backgroundColor,
    ["--page-text" as string]: t.textColor,
    background: t.backgroundColor,
    color: t.textColor,
    fontFamily: FONT_STACK[t.fontFamily],
  } as React.CSSProperties;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// Só valores conhecidos e válidos chegam à página pública (viram CSS inline).
export function normalizeTheme(raw: unknown): Partial<FlowTheme> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<FlowTheme> = {};
  for (const k of ["primaryColor", "backgroundColor", "textColor"] as const) {
    if (typeof r[k] === "string" && HEX.test(r[k] as string)) out[k] = r[k] as string;
  }
  if (r.fontFamily === "sans" || r.fontFamily === "serif" || r.fontFamily === "rounded") out.fontFamily = r.fontFamily;
  if (r.buttonFill === "solid" || r.buttonFill === "soft") out.buttonFill = r.buttonFill;
  const radius = Number(r.buttonRadius);
  if (r.buttonRadius !== undefined && r.buttonRadius !== null && Number.isFinite(radius)) out.buttonRadius = Math.min(28, Math.max(0, Math.round(radius)));
  if (typeof r.progressBar === "boolean") out.progressBar = r.progressBar;
  const logo = typeof r.logoUrl === "string" ? safeFileUrl(r.logoUrl.slice(0, 500)) : null;
  if (logo) out.logoUrl = logo;
  return out;
}

// Tema visual de um funil (aba Design). Aplicado ao FlowRunner via CSS vars.

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
    background: t.backgroundColor,
    color: t.textColor,
    fontFamily: FONT_STACK[t.fontFamily],
  } as React.CSSProperties;
}

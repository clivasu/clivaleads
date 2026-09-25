// Fontes disponíveis no Link na Bio (carregadas no app via next/font + Fontshare).
export const BIO_FONTS: { key: string; label: string; css: string }[] = [
  { key: "poppins", label: "Moderna", css: "var(--font-poppins), system-ui, sans-serif" },
  { key: "inter", label: "Clean", css: "var(--font-sans), system-ui, sans-serif" },
  { key: "general", label: "Geométrica", css: '"General Sans", var(--font-poppins), sans-serif' },
  { key: "playfair", label: "Elegante", css: "var(--font-playfair), Georgia, serif" },
  { key: "ptserif", label: "Serifada", css: "var(--font-ptserif), Georgia, serif" },
  { key: "script", label: "Manuscrita", css: "var(--font-script), cursive" },
];

// Resolve uma chave de fonte (com retrocompatibilidade: serif/sans/script).
export function bioFont(key?: string): string | undefined {
  if (!key) return undefined;
  if (key === "serif") return "var(--font-playfair), Georgia, serif";
  if (key === "sans") return "var(--font-poppins), system-ui, sans-serif";
  if (key === "script") return "var(--font-script), cursive";
  return BIO_FONTS.find((f) => f.key === key)?.css;
}

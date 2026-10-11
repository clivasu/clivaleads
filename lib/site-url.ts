// Origem canônica do site para links de retorno (checkout, portal, e-mails).
// Não usa o header Host da requisição, que pode ser manipulado.
const ALLOWED = ["https://cliva.me", "https://www.cliva.me"];

export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (env && (ALLOWED.includes(env) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(env))) return env;
  if (process.env.NODE_ENV !== "production") return env || "http://localhost:3000";
  return "https://cliva.me";
}

// Identificador público da conta: cliva.me/<handle>/<funil>.
// Regras compartilhadas entre cadastro, Configurações e servidor.

// Rotas e nomes do próprio app que não podem virar identificador.
export const RESERVED_HANDLES = new Set([
  "f", "api", "login", "cadastro", "dashboard", "flows", "leads", "analytics",
  "schedule", "settings", "admin", "new", "builder", "assinar", "bio",
  "templates", "brand", "_next", "favicon.ico", "icon.png", "apple-icon.png",
  "www", "app", "cliva", "suporte", "ajuda", "help", "blog", "planos",
]);

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

export function slugifyHandle(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX);
}

// Versão para digitação: permite o hífen no fim enquanto a pessoa escreve.
export function typingHandle(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, HANDLE_MAX);
}

// Erro de formato (null = formato válido; a disponibilidade é checada no servidor).
export function handleFormatError(handle: string): string | null {
  if (handle.length < HANDLE_MIN) return `Use pelo menos ${HANDLE_MIN} letras ou números.`;
  if (RESERVED_HANDLES.has(handle)) return `"${handle}" é reservado. Escolha outro.`;
  return null;
}

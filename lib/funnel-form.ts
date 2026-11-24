import type { FormField, LeadAnswer } from "@/lib/types";

// Formulário do funil: validação dos campos e o que vai para o lead.
// Nome, telefone e e-mail são colunas do lead; qualquer outro campo
// (Instagram, cidade, empresa…) é guardado como resposta.

export const CONTACT_FIELDS = new Set(["name", "phone", "email"]);

// Mensagem de erro do campo, ou null quando está certo.
export function fieldError(f: FormField, raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return f.required ? "Campo obrigatório" : null;
  if (f.type === "tel") {
    const d = v.replace(/\D/g, "");
    return d.length >= 10 && d.length <= 13 ? null : "Informe o número com DDD";
  }
  if (f.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "E-mail inválido";
  return f.required && v.length < 2 ? "Preencha este campo" : null;
}

export function extraAnswers(fields: FormField[], vals: Record<string, string>): LeadAnswer[] {
  return fields
    .filter((f) => !CONTACT_FIELDS.has(f.name) && (vals[f.name] ?? "").trim())
    .map((f) => {
      const v = vals[f.name].trim().slice(0, 500);
      return { question_title: f.label.slice(0, 300), answer_value: v, answer_label: v, score: 0 };
    });
}

// Respostas de formulário substituem as anteriores do mesmo campo (a pessoa
// pode voltar ao formulário por um desvio do funil).
export function mergeAnswers(prev: LeadAnswer[], next: LeadAnswer[]): LeadAnswer[] {
  const titles = new Set(next.map((a) => a.question_title));
  return [...prev.filter((a) => !titles.has(a.question_title)), ...next];
}

// Arquivo do bloco "Material grátis": link https ou arquivo do próprio site.
export function safeFileUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (/^\/(?![/\\])/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch { return null; }
}

// "@perfil", "perfil" ou o link do Instagram viram o link do perfil.
export function instagramUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i);
  const handle = (m ? m[1] : s).replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : null;
}

import "server-only";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

// Prova de posse da sessão do lead: o POST que cria o lead devolve um token
// assinado; o PATCH (clique no WhatsApp) só é aceito com esse token. Um UUID
// sozinho não autoriza a alterar a sessão.
const TTL_MS = 24 * 60 * 60 * 1000;

function key(): Buffer | null {
  const explicit = process.env.LEAD_TOKEN_SECRET;
  if (explicit) return Buffer.from(explicit);
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sr) return createHash("sha256").update(`cliva-lead-token:${sr}`).digest();
  return null;
}

function sign(id: string, exp: number, k: Buffer) {
  return createHmac("sha256", k).update(`${id}.${exp}`).digest("base64url");
}

export function issueLeadToken(id: string, now = Date.now()): string | null {
  const k = key();
  if (!k) return null;
  const exp = now + TTL_MS;
  return `${exp}.${sign(id, exp, k)}`;
}

export function verifyLeadToken(id: string, token: string, now = Date.now()): boolean {
  const k = key();
  if (!k) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < now) return false;
  const expected = Buffer.from(sign(id, exp, k));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

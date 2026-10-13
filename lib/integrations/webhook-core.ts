import { BlockList, isIP } from "node:net";
import { createHmac, timingSafeEqual } from "node:crypto";

// Regras do webhook sem rede nem banco (testáveis isoladamente).

// --- Endereços proibidos (SSRF) ----------------------------------------------
// Rede interna, loopback, link-local (inclui 169.254.169.254, metadata de
// nuvem), CGNAT, faixas reservadas/documentação, multicast e NAT64.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
  ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["2001:db8::", 32], ["2001::", 32], ["2002::", 16], ["100::", 64],
] as const) blocked.addSubnet(net, prefix, "ipv6");

export function isBlockedAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 0) return true; // não é IP: não confiar
  if (v === 6) {
    const lower = address.toLowerCase();
    // IPv4 embutido (::ffff:10.0.0.1, ::10.0.0.1): vale a regra do IPv4.
    const mapped = lower.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16), lo = parseInt(hexMapped[2], 16);
      return isBlockedAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return blocked.check(address, "ipv6");
  }
  return blocked.check(address, "ipv4");
}

// --- URL ----------------------------------------------------------------------
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet"];

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

// Validação estática (antes de salvar e antes de enviar). A checagem do IP
// real acontece na conexão (webhook-http.ts), para valer também após DNS.
export function validateWebhookUrl(raw: string): UrlCheck {
  const s = (raw ?? "").trim();
  if (!s) return { ok: false, error: "Informe a URL do webhook." };
  if (s.length > 500) return { ok: false, error: "URL longa demais." };
  let url: URL;
  try { url = new URL(s); } catch { return { ok: false, error: "URL inválida." }; }
  if (url.protocol !== "https:") return { ok: false, error: "A URL do webhook precisa começar com https://" };
  if (url.username || url.password) return { ok: false, error: "Não use usuário e senha na URL; use o segredo." };
  if (url.port && url.port !== "443") return { ok: false, error: "Use a porta padrão do HTTPS (443)." };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || !host.includes(".") && isIP(host) === 0 || BLOCKED_HOST_SUFFIXES.some((x) => host.endsWith(x))) {
    return { ok: false, error: "Endereço interno não é permitido." };
  }
  if (isIP(host) !== 0 && isBlockedAddress(host)) return { ok: false, error: "Endereço interno não é permitido." };
  return { ok: true, url };
}

// --- Assinatura ----------------------------------------------------------------
// Header: X-Cliva-Signature: t=<unix>,v1=<hex(hmac_sha256(segredo, "<t>.<corpo>"))>
export function signPayload(secret: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

// Verificação (a mesma que o CRM deve fazer; usada nos testes e na doc).
export function verifySignature(secret: string, header: string, body: string, toleranceSec = 300, now = Date.now()): boolean {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = Buffer.from(signPayload(secret, t, body).split("v1=")[1], "hex");
  const got = Buffer.from(m[2], "hex");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// --- Novas tentativas -----------------------------------------------------------
// Atraso depois da tentativa n (1ª falha = 1 min ... 5ª = 12 h). Na 6ª falha, desiste.
const BACKOFF_SEC = [60, 300, 1800, 7200, 43200];
export const MAX_ATTEMPTS = BACKOFF_SEC.length + 1;
export function nextRetryDelaySec(attempts: number): number | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return BACKOFF_SEC[Math.max(0, attempts - 1)] ?? null;
}

// --- Conteúdo enviado -------------------------------------------------------------
export interface LeadPayloadInput {
  deliveryId: string;
  lead: {
    id: string; created_at: string; name: string | null; phone: string | null; email: string | null;
    score: number; procedure: string | null; whatsapp_clicked: boolean; status: string;
    utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null;
  };
  flow: { id: string; name: string; slug: string };
  organization: { slug: string };
  answers?: { question_title: string; answer_label: string }[]; // só com opt-in da clínica
}

// Conteúdo mínimo: contato, interesse e origem. Respostas do questionário
// (podem ser dado de saúde) só quando a clínica liga a opção.
export function buildLeadPayload(i: LeadPayloadInput, siteUrl: string) {
  const tier = i.lead.score >= 61 ? "hot" : i.lead.score >= 31 ? "warm" : "cold";
  return {
    id: i.deliveryId,
    event: "lead.created",
    created_at: i.lead.created_at,
    lead: {
      id: i.lead.id,
      name: i.lead.name,
      phone: i.lead.phone,
      email: i.lead.email,
      procedure: i.lead.procedure,
      score: i.lead.score,
      interest: tier,
      disqualified: i.lead.status === "lost", // foi para o final "sem interesse"
      whatsapp_clicked: i.lead.whatsapp_clicked,
      utm: {
        source: i.lead.utm_source, medium: i.lead.utm_medium, campaign: i.lead.utm_campaign,
        content: i.lead.utm_content, term: i.lead.utm_term,
      },
      ...(i.answers ? { answers: i.answers.map((a) => ({ question: a.question_title, answer: a.answer_label })) } : {}),
    },
    funnel: { id: i.flow.id, name: i.flow.name, url: `${siteUrl}/${i.organization.slug}/${i.flow.slug}` },
  };
}

export function buildTestPayload(flow: { id: string; name: string }, siteUrl: string) {
  return {
    id: "test",
    event: "webhook.test",
    created_at: new Date().toISOString(),
    test: true,
    message: "Teste de webhook da Cliva. Nenhum lead foi criado.",
    funnel: { id: flow.id, name: flow.name, url: siteUrl },
  };
}

// Motivo curto, sem dados pessoais, para o histórico.
export function shortError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === "BLOCKED_ADDRESS") return "endereço interno bloqueado";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "domínio não encontrado";
  if (code === "ECONNREFUSED") return "conexão recusada";
  if (code === "ETIMEDOUT" || code === "TIMEOUT") return "tempo esgotado (10 s)";
  if (code === "CERT_HAS_EXPIRED" || String(code ?? "").includes("CERT") || code === "DEPTH_ZERO_SELF_SIGNED_CERT") return "certificado HTTPS inválido";
  if (code === "ECONNRESET") return "conexão interrompida";
  return "falha de conexão";
}

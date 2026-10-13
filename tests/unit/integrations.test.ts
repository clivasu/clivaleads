import { describe, expect, it } from "vitest";
import {
  buildLeadPayload, isBlockedAddress, nextRetryDelaySec, MAX_ATTEMPTS, signPayload, validateWebhookUrl, verifySignature,
} from "@/lib/integrations/webhook-core";
import { guardedLookup, postJson } from "@/lib/integrations/webhook-http";
import { normalizePixelId, normalizePublicSettings, toPublicConfig } from "@/lib/public-funnel-config";
import { funnelMetadata } from "@/lib/seo";

describe("4.2 webhook: proteção contra SSRF", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "224.0.0.1",
  ])("bloqueia %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "200.147.67.142", "2606:4700:4700::1111"])("permite %s", (ip) => expect(isBlockedAddress(ip)).toBe(false));

  it.each([
    ["http://crm.com/hook", "https://"],
    ["https://localhost/hook", "interno"],
    ["https://127.0.0.1/hook", "interno"],
    ["https://[::1]/hook", "interno"],
    ["https://169.254.169.254/latest/meta-data", "interno"],
    ["https://intranet/hook", "interno"],
    ["https://crm.local/hook", "interno"],
    ["https://user:senha@crm.com/hook", "segredo"],
    ["https://crm.com:8443/hook", "443"],
    ["ftp://crm.com", "https://"],
  ])("recusa %s", (url, msg) => {
    const r = validateWebhookUrl(url);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });

  it("aceita https público", () => expect(validateWebhookUrl("https://hooks.zapier.com/hooks/catch/1/abc?x=1").ok).toBe(true));

  it("checa o IP depois do DNS (DNS rebinding / domínio que aponta para rede interna)", async () => {
    const run = (addrs: { address: string; family: number }[]) => new Promise<{ err: unknown; addr: unknown }>((resolve) => {
      const lookup = guardedLookup((_h, cb) => cb(null, addrs as never));
      (lookup as unknown as (h: string, o: object, cb: (e: unknown, a?: unknown) => void) => void)("crm.com", {}, (err, addr) => resolve({ err, addr }));
    });
    expect((await run([{ address: "10.0.0.5", family: 4 }])).err).toMatchObject({ code: "BLOCKED_ADDRESS" });
    // basta um endereço interno na resposta para recusar
    expect((await run([{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }])).err).toMatchObject({ code: "BLOCKED_ADDRESS" });
    expect(await run([{ address: "8.8.8.8", family: 4 }])).toEqual({ err: null, addr: "8.8.8.8" });
  });

  it("envio real para domínio que resolve para IP interno nunca conecta", async () => {
    const r = await postJson("https://crm-falso.com/hook", "{}", {}, { resolver: (_h, cb) => cb(null, [{ address: "169.254.169.254", family: 4 }]) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ code: "BLOCKED_ADDRESS" });
  });
});

describe("4.2 webhook: assinatura, tentativas e conteúdo", () => {
  it("HMAC confere e detecta corpo alterado, segredo errado e envio antigo", () => {
    const t = Math.floor(Date.now() / 1000);
    const h = signPayload("whsec_x", t, '{"a":1}');
    expect(verifySignature("whsec_x", h, '{"a":1}')).toBe(true);
    expect(verifySignature("whsec_x", h, '{"a":2}')).toBe(false);
    expect(verifySignature("outro", h, '{"a":1}')).toBe(false);
    expect(verifySignature("whsec_x", signPayload("whsec_x", t - 3600, "{}"), "{}")).toBe(false);
  });

  it("espera crescente e desiste na 6ª falha", () => {
    expect([1, 2, 3, 4, 5].map(nextRetryDelaySec)).toEqual([60, 300, 1800, 7200, 43200]);
    expect(nextRetryDelaySec(MAX_ATTEMPTS)).toBeNull();
  });

  const lead = {
    id: "l1", created_at: "2026-10-12T10:00:00Z", name: "Ana", phone: "61999990000", email: null, score: 70,
    procedure: "Botox", whatsapp_clicked: true, status: "whatsapp",
    utm_source: "instagram", utm_medium: null, utm_campaign: "out", utm_content: null, utm_term: null,
  };
  it("sem opt-in não leva respostas do questionário", () => {
    const p = buildLeadPayload({ deliveryId: "d1", lead, flow: { id: "f", name: "F", slug: "botox" }, organization: { slug: "clinica" } }, "https://cliva.me");
    expect(p.lead).not.toHaveProperty("answers");
    expect(p).toMatchObject({ id: "d1", event: "lead.created", lead: { interest: "hot", disqualified: false }, funnel: { url: "https://cliva.me/clinica/botox" } });
    const withAnswers = buildLeadPayload({ deliveryId: "d1", lead, flow: { id: "f", name: "F", slug: "b" }, organization: { slug: "c" }, answers: [{ question_title: "Dor", answer_label: "Rugas" }] }, "https://cliva.me");
    expect(withAnswers.lead.answers).toEqual([{ question: "Dor", answer: "Rugas" }]);
  });
});

describe("4.1/4.3 configuração pública do funil", () => {
  it("IDs de pixel no formato do provedor", () => {
    expect(normalizePixelId("metaPixel", " 1234567890123 ")).toEqual({ value: "1234567890123" });
    expect(normalizePixelId("ga4", "g-abc123")).toEqual({ value: "G-ABC123" });
    expect(normalizePixelId("metaPixel", "<script>").error).toBeTruthy();
    expect(normalizePixelId("tiktokPixel", "abc").error).toBeTruthy();
  });

  it("gravação recusa link sem https e ID inválido", () => {
    const r = normalizePublicSettings({ metaPixel: "abc", ogImage: "http://x.com/a.png", redirectUrl: "javascript:alert(1)", favicon: "<b>" });
    expect(r.errors.length).toBe(4);
  });

  it("página pública só recebe o que é válido; pixel liga o aviso de consentimento", () => {
    const c = toPublicConfig({
      metaPixel: "1234567890123", ga4: "G-BAD!", gtm: "GTM-ABC1234", headScripts: "<script>x</script>", customCss: "body{}",
      webhookSecret: "x", redirectUrl: "javascript:alert(1)", privacyUrl: "https://clinica.com/privacidade", favicon: "🦷",
    });
    expect(c.pixels).toEqual({ metaPixel: "1234567890123" }); // GA4 inválido e GTM ignorados
    expect(c.consent).toMatchObject({ required: true, banner: true, privacyUrl: "https://clinica.com/privacidade" });
    expect(c.redirectUrl).toBeNull();
    expect(c.seo.favicon).toEqual({ emoji: "🦷" });
    expect(JSON.stringify(c)).not.toMatch(/<script|webhookSecret|customCss|GTM-|body\{/);
  });

  it("sem pixel nem banner, nada de consentimento", () => {
    expect(toPublicConfig({}).consent).toMatchObject({ required: false, banner: false });
  });

  it("SEO: título/descrição/OG configurados, canonical e noindex", () => {
    const m = funnelMetadata(
      { name: "F", procedure: "Botox", description: null, cover_image_url: "http://inseguro.com/x.png", slug: "botox" },
      { name: "Clínica", slug: "clinica" },
      toPublicConfig({ seoTitle: "Botox em Brasília", seoDescription: "Avaliação", ogImage: "https://cdn.com/og.png", noindex: true }),
    );
    expect(m.title).toBe("Botox em Brasília");
    expect(m.alternates?.canonical).toMatch(/\/clinica\/botox$/);
    expect(m.robots).toEqual({ index: false, follow: false });
    expect((m.openGraph as { images?: string[] }).images).toEqual(["https://cdn.com/og.png"]);
    const plain = funnelMetadata({ name: "F", procedure: null, description: null, cover_image_url: "http://inseguro.com/x.png", slug: "f" }, { name: "C", slug: "c" }, toPublicConfig({}));
    expect(plain.openGraph).not.toHaveProperty("images"); // capa sem https não vira OG
    expect(plain.robots).toBeUndefined();
  });
});

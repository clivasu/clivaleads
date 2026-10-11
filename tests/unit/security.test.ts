import { beforeAll, describe, expect, it } from "vitest";
import { bioClickSchema, sessionCreateSchema, sessionPatchSchema, trackEventSchema } from "@/lib/security/validation";
import { issueLeadToken, verifyLeadToken } from "@/lib/security/lead-token";
import { rateLimit } from "@/lib/security/rate-limit";
import { scoreAnswers, totalFrom } from "@/lib/security/scoring";
import type { FlowStep } from "@/lib/types";

const FLOW = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";

describe("validação das APIs públicas", () => {
  it("aceita um lead legítimo", () => {
    const r = sessionCreateSchema.safeParse({
      flow_id: FLOW, client_ref: ID, procedure: "Botox",
      answers: [{ question_title: "Objetivo", answer_value: "testa", answer_label: "Testa", score: 15 }],
      contact: { name: "Ana", phone: "61999990000" }, device: "mobile", entry_page: "/a/b",
    });
    expect(r.success).toBe(true);
  });
  it("recusa flow_id inválido, respostas demais e textos gigantes", () => {
    expect(sessionCreateSchema.safeParse({ flow_id: "abc", answers: [] }).success).toBe(false);
    const many = Array.from({ length: 61 }, () => ({ question_title: "q", answer_value: "v", answer_label: "l" }));
    expect(sessionCreateSchema.safeParse({ flow_id: FLOW, answers: many }).success).toBe(false);
    expect(sessionCreateSchema.safeParse({ flow_id: FLOW, answers: [], contact: { name: "x".repeat(500) } }).success).toBe(false);
  });
  it("PATCH exige id válido e token", () => {
    expect(sessionPatchSchema.safeParse({ id: ID }).success).toBe(false);
    expect(sessionPatchSchema.safeParse({ id: ID, token: "123.abcdefghij" }).success).toBe(true);
  });
  it("tracking só aceita os tipos gravados", () => {
    expect(trackEventSchema.safeParse({ type: "page_view", flow_id: FLOW }).success).toBe(true);
    expect(trackEventSchema.safeParse({ type: "drop_table", flow_id: FLOW }).success).toBe(false);
  });
  it("clique da bio recusa javascript: e aceita https/tel/mailto", () => {
    expect(bioClickSchema.safeParse({ bio_page_id: ID, url: "javascript:alert(1)" }).success).toBe(false);
    for (const url of ["https://x.com", "tel:+5561", "mailto:a@b.com", "/cliva/botox"]) {
      expect(bioClickSchema.safeParse({ bio_page_id: ID, url }).success, url).toBe(true);
    }
  });
});

describe("token de posse da sessão do lead", () => {
  beforeAll(() => { process.env.LEAD_TOKEN_SECRET = "segredo-de-teste"; });
  it("token emitido valida para a mesma sessão", () => {
    const t = issueLeadToken(ID)!;
    expect(verifyLeadToken(ID, t)).toBe(true);
  });
  it("token de uma sessão não vale para outra", () => {
    const t = issueLeadToken(ID)!;
    expect(verifyLeadToken(FLOW, t)).toBe(false);
  });
  it("token adulterado ou expirado é recusado", () => {
    const t = issueLeadToken(ID, 0)!; // expirou em 24h depois de 1970
    expect(verifyLeadToken(ID, t)).toBe(false);
    const ok = issueLeadToken(ID)!;
    expect(verifyLeadToken(ID, ok.slice(0, -2) + "xx")).toBe(false);
    expect(verifyLeadToken(ID, "999999999999999.qualquer")).toBe(false);
  });
});

describe("pontuação recalculada no servidor", () => {
  const steps = [
    { id: "s1", flow_id: FLOW, position: 0, type: "question", config: { title: "Objetivo", options: [{ label: "Testa", value: "testa", score: 15 }, { label: "Olhos", value: "olhos", score: 10 }] } },
    { id: "s2", flow_id: FLOW, position: 1, type: "multi_choice", config: { title: "Incômodos", options: [{ label: "A", value: "a", score: 10 }, { label: "B", value: "b", score: 5 }] } },
    { id: "s3", flow_id: FLOW, position: 2, type: "rating", config: { title: "Nota", mode: "scale", min: 0, max: 10 } },
  ] as unknown as FlowStep[];

  it("usa a pontuação do funil, não a enviada pelo navegador", () => {
    const s = scoreAnswers(steps, [
      { question_title: "Objetivo", answer_value: "testa" },
      { question_title: "Incômodos", answer_value: "a,b" },
      { question_title: "Nota", answer_value: "8" },
    ]);
    expect(s).toEqual([15, 15, 16]);
    expect(totalFrom(s)).toBe(46);
  });
  it("resposta inexistente ou fora da escala vale zero; total limitado a 100", () => {
    expect(scoreAnswers(steps, [{ question_title: "Objetivo", answer_value: "hack" }])).toEqual([0]);
    expect(scoreAnswers(steps, [{ question_title: "Nota", answer_value: "999" }])).toEqual([0]);
    expect(totalFrom([90, 90])).toBe(100);
  });
});

describe("limite de requisições", () => {
  it("bloqueia acima do limite e libera na janela seguinte", () => {
    const t0 = 1_000_000;
    const key = `teste:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000, t0)).toBe(true);
    expect(rateLimit(key, 3, 60_000, t0)).toBe(false);
    expect(rateLimit(key, 3, 60_000, t0 + 60_001)).toBe(true);
  });
});

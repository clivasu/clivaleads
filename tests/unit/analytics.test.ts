import { describe, expect, it } from "vitest";
import { resolvePeriod, brDate } from "@/lib/analytics/period";
import { parseFilters, filtersToQuery } from "@/lib/analytics/filters";
import { summarizeAnswers } from "@/lib/analytics/answers";
import { conversionSteps, fmtRate, rate, trend, EMPTY_TOTALS } from "@/lib/analytics/metrics";
import { estimatePotential } from "@/lib/analytics/potential";
import { sessionPatchSchema, trackSchema, trackEventSchema } from "@/lib/security/validation";

describe("períodos no fuso de Brasília", () => {
  it("30 dias incluem hoje inteiro e o anterior tem o mesmo tamanho", () => {
    // 11/10/2026 01:30 em Brasília (04:30 UTC)
    const p = resolvePeriod("30d", new Date("2026-10-11T04:30:00Z"));
    expect(p.to).toBe("2026-10-12T03:00:00.000Z");
    expect(p.from).toBe("2026-09-12T03:00:00.000Z");
    expect(p.prevTo).toBe(p.from);
    expect(p.prevFrom).toBe("2026-08-13T03:00:00.000Z");
    expect(p.bucket).toBe("day");
  });

  it("23h em Brasília ainda é o mesmo dia (UTC já virou)", () => {
    const now = new Date("2026-10-12T02:00:00Z"); // 11/10 23:00 em Brasília
    expect(brDate(now)).toBe("2026-10-11");
    expect(resolvePeriod("7d", now).to).toBe("2026-10-12T03:00:00.000Z");
  });

  it("12 meses começam no dia 1 e agrupam por mês", () => {
    const p = resolvePeriod("12m", new Date("2026-10-11T15:00:00Z"));
    expect(p.from).toBe("2025-11-01T03:00:00.000Z");
    expect(p.prevFrom).toBe("2024-11-01T03:00:00.000Z");
    expect(p.bucket).toBe("month");
  });

  it("90 dias agrupam por semana", () => {
    expect(resolvePeriod("90d", new Date("2026-10-11T15:00:00Z")).bucket).toBe("week");
  });
});

describe("filtros da URL", () => {
  it("aceita só valores válidos", () => {
    expect(parseFilters({ periodo: "7d", funil: "não-é-uuid", origem: "instagram" })).toEqual({
      range: "7d", flow: null, procedure: null, source: "instagram", campaign: null,
    });
    expect(parseFilters({ periodo: "999d" }).range).toBe("30d");
    const id = "aaaaaaaa-0000-4000-8000-000000000001";
    expect(parseFilters({ funil: [id, "x"] }).flow).toBe(id);
  });

  it("ida e volta pela URL", () => {
    const f = parseFilters({ periodo: "90d", procedimento: "Botox", campanha: "Rino Set" });
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
  });
});

describe("taxas com denominador explícito", () => {
  it("sem denominador não inventa 0%", () => {
    expect(rate(5, 0)).toBeNull();
    expect(fmtRate(null)).toBe("—");
    expect(rate(1, 3)).toBe(33.3);
    expect(trend(10, 0)).toBeNull();
    expect(trend(15, 10)).toBe(50);
  });

  it("cada etapa do funil usa a anterior como base", () => {
    const s = conversionSteps({ ...EMPTY_TOTALS, visits: 5, starts: 3, completions: 2, whatsapp_clicks: 1, appointments: 1, leads: 3 });
    expect(s.map((x) => [x.key, x.rate])).toEqual([
      ["visits", null], ["starts", 60], ["completions", 66.7], ["whatsapp_clicks", 50], ["appointments", 33.3],
    ]);
  });
});

describe("perfil a partir das respostas agregadas", () => {
  it("separa gênero, idade e dores somando os totais", () => {
    const p = summarizeAnswers([
      { question_title: "Sexo", answer_label: "Feminino", total: 7 },
      { question_title: "Sexo", answer_label: "Masculino", total: 2 },
      { question_title: "Qual sua idade?", answer_label: "25-34 anos", total: 5 },
      { question_title: "O que mais incomoda?", answer_label: "Rugas na testa", total: 4 },
      { question_title: "O que mais incomoda?", answer_label: "Olheiras", total: 6 },
      { question_title: "Quando pretende realizar?", answer_label: "Este mês", total: 9 },
    ]);
    expect(p.gender).toEqual({ female: 7, male: 2 });
    expect(p.ages).toEqual([{ label: "25-34 anos", count: 5 }]);
    expect(p.pains).toEqual([{ label: "Olheiras", count: 6 }, { label: "Rugas na testa", count: 4 }]);
  });

  it("sem gênero/idade coletados devolve null (não zero)", () => {
    const p = summarizeAnswers([{ question_title: "Dor", answer_label: "Manchas", total: 1 }]);
    expect(p.gender).toBeNull();
    expect(p.ages).toBeNull();
  });
});

describe("potencial estimado", () => {
  it("ticket por procedimento × leads que avançaram", () => {
    expect(estimatePotential([{ procedure: "Rinomodelação", advanced: 2 }, { procedure: "—", advanced: 1 }])).toBe(2 * 1200 + 800);
  });
});

describe("contratos das APIs públicas (Entrega C)", () => {
  const flow = "aaaaaaaa-0000-4000-8000-000000000001";
  it("evento aceita event_id e posição da etapa, recusa tipos legados e metadados de resposta", () => {
    const ok = trackEventSchema.safeParse({ type: "step_view", flow_id: flow, event_id: crypto.randomUUID(), step_index: 2, step_id: "abc" });
    expect(ok.success).toBe(true);
    expect(trackEventSchema.safeParse({ type: "option_clicked", flow_id: flow }).success).toBe(false);
    expect(trackEventSchema.safeParse({ type: "step_view", flow_id: flow, step_index: -1 }).success).toBe(false);
    const parsed = trackEventSchema.parse({ type: "page_view", flow_id: flow, metadata: { resposta: "x" } });
    expect("metadata" in parsed).toBe(false);
    expect(trackSchema.safeParse({ events: [{ type: "page_view", flow_id: flow }] }).success).toBe(true);
  });

  it("PATCH distingue WhatsApp de botão final (padrão: WhatsApp, compatível com o app antigo)", () => {
    const base = { id: flow, token: "x".repeat(20) };
    expect(sessionPatchSchema.parse(base).action).toBe("whatsapp");
    expect(sessionPatchSchema.parse({ ...base, action: "final_cta" }).action).toBe("final_cta");
    expect(sessionPatchSchema.safeParse({ ...base, action: "agendado" }).success).toBe(false);
  });
});

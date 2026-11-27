import { describe, expect, it } from "vitest";
import { answerTitle, buildVars, definedVars, fillVars, personalizeStep, varKey } from "@/lib/personalize";
import { scoreAnswers } from "@/lib/security/scoring";
import { answerSchema } from "@/lib/security/validation";
import { blockLabel, defaultConfig, BLOCK_CATALOG } from "@/lib/block-catalog";
import type { FlowStep, LeadAnswer } from "@/lib/types";

const step = (id: string, type: FlowStep["type"], config: FlowStep["config"]): FlowStep => ({ id, flow_id: "f", position: 0, type, config });
const steps: FlowStep[] = [
  step("n", "open_answer", { title: "Como posso te chamar?", save_as: "name", answer_kind: "short" }),
  step("d", "open_answer", { title: "{nome}, qual sua maior dificuldade hoje no empreendedorismo?", answer_kind: "long", key: "dificuldade" }),
  step("q", "question", { title: "{nome}, onde você atende?", key: "Local de atendimento", options: [{ label: "Consultório", value: "c", score: 20 }, { label: "Home care, {nome}", value: "h", score: 10 }] }),
  step("m", "multi_choice", { title: "O que você já tem?", key: "tem", options: [{ label: "Instagram", value: "ig", score: 5 }, { label: "Site", value: "site", score: 5 }] }),
  step("r", "text", { title: "Obrigada, {nome}!", body: "Você atende em {local_de_atendimento}, já tem {tem} e disse: {dificuldade}. Prêmio: {premio}" }),
];
const known = new Set(definedVars(steps));

describe("personalização do funil", () => {
  it("variáveis disponíveis e nomes normalizados", () => {
    expect(varKey("Local de Atendimento!")).toBe("local_de_atendimento");
    expect(definedVars(steps)).toEqual(["nome", "nome_completo", "dificuldade", "local_de_atendimento", "tem"]);
  });

  it("nome, escolhida, marcadas e escrita aparecem nos blocos seguintes", () => {
    const answers: LeadAnswer[] = [
      { question_title: steps[1].config.title!, answer_value: "Vender sem desconto", answer_label: "Vender sem desconto", score: 0 },
      { question_title: steps[2].config.title!, answer_value: "c", answer_label: "Consultório", score: 20 },
      { question_title: steps[3].config.title!, answer_value: "ig,site", answer_label: "Instagram, Site", score: 10 },
    ];
    const vars = buildVars(steps, answers, "  maria   clara souza ");
    expect(vars).toMatchObject({ nome: "Maria", nome_completo: "maria clara souza", dificuldade: "Vender sem desconto", local_de_atendimento: "Consultório", tem: "Instagram, Site" });
    const out = personalizeStep(steps[4], vars, known);
    expect(out.config.title).toBe("Obrigada, Maria!");
    expect(out.config.body).toBe("Você atende em Consultório, já tem Instagram, Site e disse: Vender sem desconto. Prêmio: {premio}");
    const q = personalizeStep(steps[2], vars, known);
    expect(q.config.title).toBe("Maria, onde você atende?");
    expect(q.config.options![1]).toEqual({ label: "Home care, Maria", value: "h", score: 10 });
    expect(q.config.key).toBe("Local de atendimento"); // só textos visíveis mudam
  });

  it("sem nome: some sem deixar vírgula solta; na prévia mostra exemplo", () => {
    const k = known;
    expect(fillVars("{nome}, qual sua maior dificuldade?", {}, k)).toBe("Qual sua maior dificuldade?");
    expect(fillVars("Obrigada, {nome}!", {}, k)).toBe("Obrigada!");
    expect(fillVars("Oi {nome}! Tudo bem?", {}, k)).toBe("Oi! Tudo bem?");
    expect(fillVars("Pronto {nome}. {nome}, agora escolha", {}, k)).toBe("Pronto. Agora escolha");
    expect(fillVars("{nome}, qual sua maior dificuldade?", {}, k, true)).toBe("Ana, qual sua maior dificuldade?");
    expect(fillVars("Você disse {dificuldade}", {}, k, true)).toBe("Você disse [dificuldade]");
  });

  it("bloco sem variáveis continua o mesmo objeto (não reinicia efeitos)", () => {
    const s = step("x", "booking", { title: "Escolha o horário" });
    expect(personalizeStep(s, { nome: "Ana" }, known)).toBe(s);
  });

  it("a pontuação usa o título original, não o personalizado", () => {
    const a = [{ question_title: steps[2].config.title!, answer_value: "c" }];
    expect(scoreAnswers(steps, a)).toEqual([20]);
    expect(scoreAnswers(steps, [{ question_title: "Maria, onde você atende?", answer_value: "c" }])).toEqual([0]);
  });

  it("resposta longa cabe na API; acima do limite é recusada", () => {
    const ok = { question_title: "Q", answer_value: "a".repeat(2000), answer_label: "a".repeat(2000) };
    expect(answerSchema.safeParse(ok).success).toBe(true);
    expect(answerSchema.safeParse({ ...ok, answer_value: "a".repeat(2001) }).success).toBe(false);
  });

  it("blocos no catálogo: curta, longa e o mágico do nome", () => {
    const open = BLOCK_CATALOG.filter((b) => b.type === "open_answer").map((b) => b.label);
    expect(open).toEqual(["✨ Nome (bloco mágico)", "Resposta curta", "Resposta longa"]);
    const name = BLOCK_CATALOG.find((b) => b.id === "open_name")!;
    expect(blockLabel({ type: "open_answer", config: { ...defaultConfig("open_answer"), ...name.preset } })).toBe("✨ Nome (bloco mágico)");
    expect(blockLabel({ type: "open_answer", config: { answer_kind: "long" } })).toBe("Resposta longa");
    expect(blockLabel({ type: "question", config: {} })).toBe("Escolha única");
  });

  it("no painel a pergunta aparece com o nome do lead", () => {
    expect(answerTitle("{nome}, qual sua maior dificuldade?", "maria clara")).toBe("Maria, qual sua maior dificuldade?");
    expect(answerTitle("{nome}, qual sua maior dificuldade?", null)).toBe("Qual sua maior dificuldade?");
    expect(answerTitle("Você disse {dificuldade}", "Ana")).toBe("Você disse {dificuldade}");
  });
});

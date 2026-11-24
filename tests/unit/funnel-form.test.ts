import { describe, expect, it } from "vitest";
import { extraAnswers, fieldError, instagramUrl, mergeAnswers, safeFileUrl } from "@/lib/funnel-form";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { prepareStepsForSave } from "@/lib/flow-persistence";
import { defaultConfig } from "@/lib/block-catalog";
import type { FlowStep, FormField } from "@/lib/types";

const F = (name: string, type: FormField["type"], required = true): FormField => ({ name, label: name === "instagram" ? "Instagram" : name, type, required });

describe("formulário do funil", () => {
  it("telefone, e-mail e obrigatórios", () => {
    expect(fieldError(F("phone", "tel"), "(61) 99999-8888")).toBeNull();
    expect(fieldError(F("phone", "tel"), "+55 61 99999-8888")).toBeNull();
    expect(fieldError(F("phone", "tel"), "9999-8888")).toBe("Informe o número com DDD");
    expect(fieldError(F("email", "email"), "ana@x")).toBe("E-mail inválido");
    expect(fieldError(F("email", "email"), "ana@clinica.com.br")).toBeNull();
    expect(fieldError(F("name", "text"), "  ")).toBe("Campo obrigatório");
    expect(fieldError(F("email", "email", false), "")).toBeNull();
  });

  it("campos extras viram respostas; nome, telefone e e-mail não", () => {
    const fields = [F("name", "text"), F("phone", "tel"), F("email", "email"), F("instagram", "text"), F("cidade", "text", false)];
    expect(extraAnswers(fields, { name: "Ana", phone: "61999998888", email: "a@b.co", instagram: " @ana ", cidade: " " }))
      .toEqual([{ question_title: "Instagram", answer_value: "@ana", answer_label: "@ana", score: 0 }]);
  });

  it("reenviar o formulário troca a resposta, sem duplicar", () => {
    const a = (question_title: string, v: string) => ({ question_title, answer_value: v, answer_label: v, score: 0 });
    expect(mergeAnswers([a("Instagram", "@x"), a("Outra", "1")], [a("Instagram", "@y")])).toEqual([a("Outra", "1"), a("Instagram", "@y")]);
  });

  it("arquivo do material: só https ou arquivo do próprio site", () => {
    expect(safeFileUrl("/materiais/a.pdf")).toBe("/materiais/a.pdf");
    expect(safeFileUrl("https://x.com/a.pdf")).toBe("https://x.com/a.pdf");
    for (const bad of ["javascript:alert(1)", "//evil.com/a", "/\\evil.com", "http://x.com/a.pdf", "data:text/html,x", "", undefined]) expect(safeFileUrl(bad)).toBeNull();
  });

  it("instagram vira link do perfil", () => {
    expect(instagramUrl("@ana.silva_1")).toBe("https://instagram.com/ana.silva_1");
    expect(instagramUrl("https://www.instagram.com/ana/?hl=pt")).toBe("https://instagram.com/ana");
    expect(instagramUrl("não tenho")).toBeNull();
    expect(instagramUrl("javascript:alert(1)")).toBeNull();
  });

  it("WhatsApp: põe o 55, inclusive quando o DDD é 55", () => {
    expect(normalizeWhatsapp("(61) 99999-8888")).toBe("5561999998888");
    expect(normalizeWhatsapp("(55) 99999-8888")).toBe("5555999998888");
    expect(normalizeWhatsapp("5561999998888")).toBe("5561999998888");
  });

  it("salvar no editor mantém o destino do convite", () => {
    const steps = [
      { id: "s-gift", flow_id: "f", position: 0, type: "gift", config: { ...defaultConfig("gift"), invite_goto: "s-agenda" } },
      { id: "s-agenda", flow_id: "f", position: 1, type: "booking", config: {} },
    ] as FlowStep[];
    const { rows, idMap } = prepareStepsForSave(steps);
    expect(rows[0].config.invite_goto).toBe(idMap["s-agenda"]);
  });
});

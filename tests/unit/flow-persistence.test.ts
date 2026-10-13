import { describe, expect, it } from "vitest";
import { applyIdMap, prepareStepsForSave } from "@/lib/flow-persistence";
import { DEFAULT_SETTINGS, pickPersistedSettings, splitSettings } from "@/lib/flow-settings";
import type { FlowStep } from "@/lib/types";

const UUID = /^[0-9a-f-]{36}$/;
const KEEP = "aaaaaaaa-0000-4000-8000-000000000001";

const steps = [
  { id: KEEP, flow_id: "f", position: 0, type: "question", config: { title: "Interesse?", options: [
    { label: "Sim", value: "sim", goto: "s-novo" },
    { label: "Não", value: "nao", goto: "@exit" },
  ] } },
  { id: "s-novo", flow_id: "f", position: 1, type: "rating", config: { title: "Nota", score_gate_goto: KEEP,
    rating_rules: [{ min: 0, max: 3, goto: "s-novo" }] } },
  { id: "s-cont", flow_id: "f", position: 2, type: "container", config: {}, children: [
    { id: "c1", flow_id: "f", position: 0, type: "text", config: { buttons: [{ label: "Ir", goto: "s-novo" }] } },
  ] },
] as unknown as FlowStep[];

describe("2.1 ids estáveis e lógica preservada ao salvar", () => {
  it("mantém UUIDs existentes e dá UUID definitivo às etapas novas", () => {
    const { rows, idMap } = prepareStepsForSave(steps);
    expect(rows[0].id).toBe(KEEP);
    expect(rows[1].id).toMatch(UUID);
    expect(idMap["s-novo"]).toBe(rows[1].id);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
  });

  it("reescreve goto, score_gate_goto, regras e botões de blocos aninhados", () => {
    const { rows, idMap } = prepareStepsForSave(steps);
    const novo = idMap["s-novo"];
    const opts = rows[0].config.options as { goto: string }[];
    expect(opts.map((o) => o.goto)).toEqual([novo, "@exit"]);
    expect(rows[1].config.score_gate_goto).toBe(KEEP);
    expect((rows[1].config.rating_rules as { goto: string }[])[0].goto).toBe(novo);
    const children = rows[2].config.__children as { config: { buttons: { goto: string }[] } }[];
    expect(children[0].config.buttons[0].goto).toBe(novo);
  });

  it("editor aplica o mapa e o próximo save mantém os mesmos ids", () => {
    const first = prepareStepsForSave(steps);
    const local = applyIdMap(steps, first.idMap);
    const second = prepareStepsForSave(local);
    expect(second.rows.map((r) => r.id)).toEqual(first.rows.map((r) => r.id));
    expect(Object.keys(second.idMap).length).toBe(0); // nada novo: ids já definitivos
  });
});

describe("2.2 configurações: salvar e recarregar", () => {
  const edited = {
    ...DEFAULT_SETTINGS,
    seoTitle: "Botox em Brasília", seoDescription: "Avaliação", noindex: true, ogImage: "https://x/og.webp",
    metaPixel: "123456789012345", ga4: "G-ABC123", cookieBanner: true, consentText: "Texto", privacyUrl: "https://x/p",
    redirectUrl: "https://x/obrigado", allowBack: false, customCss: ".a{}",
    webhookUrl: "https://crm.x/hook", webhookSecret: "novo-segredo", autoSendLead: true, notifyEmail: "a@b.com",
  };

  it("o JSON público não leva integrações, e o recarregado devolve o resto igual", () => {
    const { publicSettings, privateSettings } = splitSettings(edited as unknown as Record<string, unknown>);
    for (const k of ["webhookUrl", "webhookSecret", "autoSendLead", "headScripts", "notifyEmail"]) expect(publicSettings).not.toHaveProperty(k);
    expect(privateSettings).toMatchObject({ webhook_url: "https://crm.x/hook", webhook_secret: "novo-segredo", auto_send_lead: true, notify_email: "a@b.com" });
    const reloaded = { ...DEFAULT_SETTINGS, ...pickPersistedSettings(JSON.parse(JSON.stringify(publicSettings))) };
    for (const k of ["seoTitle", "seoDescription", "noindex", "ogImage", "metaPixel", "ga4", "cookieBanner", "consentText", "privacyUrl", "redirectUrl", "allowBack", "customCss"] as const) {
      expect(reloaded[k], k).toEqual(edited[k]);
    }
  });

  it("segredo vazio não apaga o atual (só troca quando digitado)", () => {
    const { privateSettings } = splitSettings({ ...edited, webhookSecret: "" } as unknown as Record<string, unknown>);
    expect(privateSettings).not.toHaveProperty("webhook_secret");
  });

  it("valores antigos com tipo errado são ignorados ao recarregar", () => {
    expect(pickPersistedSettings({ noindex: "sim", seoTitle: 42, ga4: "G-1" })).toEqual({ ga4: "G-1" });
    expect(pickPersistedSettings(null)).toEqual({});
  });
});

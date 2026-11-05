import { beforeEach, describe, expect, it, vi } from "vitest";

// Regras que o Zod 4 mudaria sem erro de compilação. As ações do servidor são
// testadas até a validação: quem chega depois dela para no login simulado.
vi.mock("@/lib/env", async (original) => ({ ...(await original<object>()), isSupabaseConfigured: true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/org", () => ({ getCurrentOrg: vi.fn(async () => null) }));
vi.mock("@/lib/data/leads", () => ({ deleteLead: vi.fn(), updateLead: vi.fn() }));

import { createManualLead } from "@/lib/actions/leads";
import { savePatient } from "@/lib/actions/patients";
import { addProfessional, saveAppointment } from "@/lib/actions/schedule";
import { cleanAnamnesis, patientSchema } from "@/lib/patients";
import {
  bioClickSchema,
  bookingCreateSchema,
  bookingSlotsSchema,
  sessionCreateSchema,
  sessionPatchSchema,
  trackEventSchema,
  trackSchema,
} from "@/lib/security/validation";

const ANTES_DO_LOGIN = "Faça login.";
const V4 = "3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c";
// Existem no supabase/seed.sql e em lib/demo-data.ts; não seguem a RFC 9562.
const IDS_DO_SEED = ["11111111-1111-1111-1111-111111111111", "22222222-0000-0000-0000-000000000001"];

beforeEach(() => vi.clearAllMocks());

describe("ids aceitos", () => {
  it.each(IDS_DO_SEED)("APIs públicas aceitam o id do seed %s", (id) => {
    expect(sessionCreateSchema.safeParse({ flow_id: id }).success).toBe(true);
    expect(sessionPatchSchema.safeParse({ id, token: "abcdefghij" }).success).toBe(true);
    expect(trackEventSchema.safeParse({ type: "page_view", flow_id: id }).success).toBe(true);
    expect(trackSchema.safeParse({ type: "page_view", flow_id: id }).success).toBe(true);
    expect(bioClickSchema.safeParse({ bio_page_id: id }).success).toBe(true);
    expect(bookingSlotsSchema.safeParse({ flow_id: id, step_id: "s", from: "2026-01-01" }).success).toBe(true);
    expect(bookingCreateSchema.safeParse({ flow_id: id, step_id: "s", date: "2026-01-01", time: "08:30", booking_ref: id, name: "Ana", phone: "61987298666" }).success).toBe(true);
  });

  it.each(IDS_DO_SEED)("ficha e agenda aceitam o id do seed %s", async (id) => {
    expect(patientSchema.safeParse({ id, name: "Ana Souza" }).success).toBe(true);
    expect((await addProfessional({ id, name: "Dra. Ana" })).error).toBe(ANTES_DO_LOGIN);
    const appt = { id, doctorId: id, patientName: "Ana", procedure: "Limpeza", date: "2026-01-01", start: 8, end: 9, status: "confirmed" as const, isReturn: false };
    expect((await saveAppointment(appt)).error).toBe(ANTES_DO_LOGIN);
  });

  it.each(["abc", "", `${V4}0`, V4.replaceAll("-", ""), ` ${V4}`])("formato errado continua recusado: %j", (id) => {
    expect(sessionCreateSchema.safeParse({ flow_id: id }).success).toBe(false);
    expect(patientSchema.safeParse({ id, name: "Ana Souza" }).success).toBe(false);
  });
});

describe("mensagens em português na ficha do paciente", () => {
  it.each([
    [{ name: "A" }, "Informe o nome completo", "name"],
    [{ name: "Ana Souza", phone: "123" }, "Telefone com DDD", "phone"],
    [{ name: "Ana Souza", cpf: "123.456.789-00" }, "CPF inválido", "cpf"],
    [{ name: "Ana Souza", birth_date: "15/01/1990" }, "Data de nascimento inválida", "birth_date"],
    [{ name: "Ana Souza", birth_date: "2999-01-01" }, "Data de nascimento inválida", "birth_date"],
    [{ name: "Ana Souza", email: "ana@" }, "E-mail inválido", "email"],
  ])("%j mostra a mensagem e marca o campo", async (input, error, field) => {
    expect(await savePatient(input)).toEqual({ ok: false, error, field });
  });

  it("dados válidos passam da validação", async () => {
    expect((await savePatient({ name: "Ana Souza", phone: "(61) 98729-8666", cpf: "529.982.247-25", email: "a@x.com" })).error).toBe(ANTES_DO_LOGIN);
  });
});

describe("mensagens em português no lead manual", () => {
  it.each([
    [{ name: "A", phone: "61987298666" }, "Informe o nome"],
    [{ name: "Ana", phone: "123" }, "Telefone com DDD"],
    [{ name: "Ana", phone: "61987298666", email: "ana@" }, "E-mail inválido"],
  ])("%j mostra a mensagem", async (input, error) => {
    expect(await createManualLead(input)).toEqual({ ok: false, error });
  });

  it("e-mail vazio é aceito", async () => {
    expect((await createManualLead({ name: "Ana", phone: "61987298666", email: "" })).error).toBe(ANTES_DO_LOGIN);
  });
});

describe("dados que a ficha do paciente grava", () => {
  it("só o nome: vazios viram null, objetos ficam vazios e consentimento é falso", () => {
    expect(patientSchema.parse({ name: "Ana Souza" })).toEqual({
      name: "Ana Souza", phone: null, cpf: null, rg: null, birth_date: null, gender: null, email: null,
      occupation: null, source: null, notes: null, address: {}, emergency_contact: {}, anamnesis: {}, consent: false,
    });
  });

  it("endereço e contato: campo ausente continua ausente e campo vazio vira null", () => {
    const p = patientSchema.parse({ name: "Ana Souza", address: { cep: " 70000-000 ", street: "" }, emergency_contact: { relation: "" } });
    expect(p.address).toStrictEqual({ cep: "70000-000", street: null });
    expect(p.emergency_contact).toStrictEqual({ relation: null });
  });

  it("anamnese: valor fora do formato é recusado e campo desconhecido some", () => {
    expect(patientSchema.safeParse({ name: "Ana Souza", anamnesis: { gestante: 1 } }).success).toBe(false);
    expect(patientSchema.parse({ name: "Ana Souza", anamnesis: { gestante: true, inventado: "x" } }).anamnesis).toEqual({ gestante: true });
  });

  it("anamnese com __proto__ forjado não polui objetos e não chega ao banco", () => {
    const input = JSON.parse('{"name":"Ana Souza","anamnesis":{"__proto__":{"gestante":true},"fumante":true}}');
    const { anamnesis } = patientSchema.parse(input);
    expect(anamnesis).toEqual(cleanAnamnesis({ fumante: true }));
    expect(Object.getPrototypeOf(anamnesis)).toBe(Object.prototype);
    expect(({} as { gestante?: boolean }).gestante).toBeUndefined();
  });
});

describe("regras das APIs públicas", () => {
  const answer = { question_title: "q", answer_value: "v", answer_label: "l" };

  it("agendamento: limpa o telefone e aceita dias em texto da URL", () => {
    const b = bookingCreateSchema.parse({ flow_id: V4, step_id: "s", date: "2026-01-01", time: "08:30", booking_ref: V4, name: " Ana ", phone: "(61) 98729-8666", email: "" });
    expect(b).toMatchObject({ name: "Ana", phone: "61987298666", email: "" });
    const dias = (days?: string) => bookingSlotsSchema.safeParse({ flow_id: V4, step_id: "s", from: "2026-01-01", days });
    expect(dias().data?.days).toBe(7);
    expect(dias("14").data?.days).toBe(14);
    expect(dias("15").success).toBe(false);
    expect(dias("abc").success).toBe(false);
  });

  it("evento em lote: mantém o limite de 50 e separa o evento individual", () => {
    const ev = { type: "page_view", flow_id: V4 };
    expect(trackSchema.safeParse({ events: Array(50).fill(ev) }).success).toBe(true);
    expect(trackSchema.safeParse({ events: Array(51).fill(ev) }).success).toBe(false);
    expect(trackSchema.parse({ ...ev, metadata: { a: 1 } })).toHaveProperty("metadata");
    expect(trackEventSchema.parse({ ...ev, metadata: { a: 1 } })).not.toHaveProperty("metadata");
  });

  it("score infinito é recusado; o navegador só envia número finito", () => {
    const body = (score: string) => JSON.parse(`{"flow_id":"${V4}","answers":[${JSON.stringify(answer).slice(0, -1)},"score":${score}}]}`);
    expect(sessionCreateSchema.safeParse(body("10")).success).toBe(true);
    expect(sessionCreateSchema.safeParse(body("1e999")).success).toBe(false);
  });
});

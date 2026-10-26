import { z } from "zod";

// Ficha do paciente (clínicas de estética/saúde). Pura: usada no servidor e na tela.

export const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

export function isValidCpf(raw: string): boolean {
  const c = onlyDigits(raw);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function formatCpf(raw: string): string {
  const c = onlyDigits(raw).slice(0, 11);
  return c.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/, "$1.$2.$3-$4");
}

export function formatPhone(raw: string): string {
  let d = onlyDigits(raw);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw ?? "";
}

export function ageFrom(birth: string | null | undefined, now = new Date()): number | null {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const [y, m, d] = birth.split("-").map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

// ── Anamnese ─────────────────────────────────────────────────────────
export type AnamField =
  | { key: string; label: string; kind: "text"; placeholder?: string; long?: boolean; alertIfFilled?: boolean }
  | { key: string; label: string; kind: "flag"; alert?: boolean; hint?: string }
  | { key: string; label: string; kind: "select"; options: string[] };

export const ANAMNESIS: { title: string; fields: AnamField[] }[] = [
  {
    title: "Saúde geral",
    fields: [
      { key: "queixa", label: "Queixa principal / objetivo", kind: "text", long: true, placeholder: "O que a paciente quer tratar e o que espera do resultado" },
      { key: "alergias", label: "Alergias (medicamentos, cosméticos, látex, anestésicos)", kind: "text", alertIfFilled: true, placeholder: "Nenhuma conhecida" },
      { key: "medicamentos", label: "Medicamentos em uso", kind: "text", long: true },
      { key: "doencas", label: "Doenças / condições (diabetes, hipertensão, tireoide…)", kind: "text", long: true },
      { key: "cirurgias", label: "Cirurgias e internações anteriores", kind: "text" },
      { key: "gestante", label: "Gestante", kind: "flag", alert: true },
      { key: "lactante", label: "Amamentando", kind: "flag", alert: true },
      { key: "anticoagulante", label: "Usa anticoagulante / AAS", kind: "flag", alert: true },
      { key: "isotretinoina", label: "Usou isotretinoína (Roacutan) nos últimos 6 meses", kind: "flag", alert: true },
      { key: "queloide", label: "Tendência a queloide ou má cicatrização", kind: "flag", alert: true },
      { key: "herpes", label: "Herpes recorrente", kind: "flag", alert: true },
      { key: "autoimune", label: "Doença autoimune", kind: "flag", alert: true },
      { key: "marcapasso", label: "Marca-passo ou implante metálico", kind: "flag", alert: true },
      { key: "epilepsia", label: "Epilepsia / convulsões", kind: "flag", alert: true },
      { key: "fumante", label: "Fumante", kind: "flag" },
      { key: "alcool", label: "Consome álcool com frequência", kind: "flag" },
    ],
  },
  {
    title: "Avaliação estética",
    fields: [
      { key: "tipo_pele", label: "Tipo de pele", kind: "select", options: ["", "Normal", "Seca", "Oleosa", "Mista", "Sensível", "Acneica"] },
      { key: "fototipo", label: "Fototipo (Fitzpatrick)", kind: "select", options: ["", "I", "II", "III", "IV", "V", "VI"] },
      { key: "protetor", label: "Usa protetor solar diariamente", kind: "flag" },
      { key: "exposicao_solar", label: "Exposição ao sol", kind: "select", options: ["", "Baixa", "Moderada", "Alta"] },
      { key: "rotina", label: "Rotina de cuidados / produtos em uso", kind: "text", long: true },
      { key: "procedimentos_anteriores", label: "Procedimentos estéticos anteriores (e reações)", kind: "text", long: true },
      { key: "observacoes_clinicas", label: "Observações clínicas da profissional", kind: "text", long: true },
    ],
  },
];

export type Anamnesis = Record<string, string | boolean>;

/** Alertas que aparecem no topo da ficha (e na Agenda). */
export function healthAlerts(a: Anamnesis): string[] {
  const out: string[] = [];
  for (const sec of ANAMNESIS) for (const f of sec.fields) {
    const v = a?.[f.key];
    if (f.kind === "flag" && f.alert && v === true) out.push(f.label.split(" (")[0].split(" / ")[0]);
    if (f.kind === "text" && f.alertIfFilled && typeof v === "string") {
      const t = v.trim();
      if (t && !/^(nenhum|nenhuma|não|nao|nada|-)\.?$/i.test(t)) out.push(`Alergia: ${t.slice(0, 60)}`);
    }
  }
  return out;
}

const KNOWN = new Map(ANAMNESIS.flatMap((s) => s.fields.map((f) => [f.key, f] as const)));
export function cleanAnamnesis(raw: unknown): Anamnesis {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Anamnesis = {};
  for (const [k, f] of KNOWN) {
    const v = src[k];
    if (f.kind === "flag") { if (v === true) out[k] = true; }
    else if (typeof v === "string" && v.trim()) {
      if (f.kind === "select" && !f.options.includes(v)) continue;
      out[k] = v.trim().slice(0, 2000);
    }
  }
  return out;
}

// ── Validação da ficha ───────────────────────────────────────────────
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const patientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome completo").max(160),
  phone: z.string().optional().transform((v) => { const d = onlyDigits(v ?? ""); return d ? d : null; })
    .refine((v) => v === null || (v.length >= 10 && v.length <= 13), "Telefone com DDD"),
  cpf: z.string().optional().transform((v) => { const d = onlyDigits(v ?? ""); return d ? d : null; })
    .refine((v) => v === null || isValidCpf(v), "CPF inválido"),
  rg: opt(30),
  birth_date: z.string().optional().transform((v) => (v ? v : null))
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)), "Data de nascimento inválida"),
  gender: z.enum(["F", "M", "O", "N", ""]).optional().transform((v) => (v ? v : null)),
  email: z.union([z.string().trim().email("E-mail inválido").max(200), z.literal("")]).optional().transform((v) => (v ? v : null)),
  occupation: opt(120),
  source: opt(60),
  notes: opt(2000),
  address: z.object({
    cep: opt(9), street: opt(160), number: opt(20), complement: opt(80), district: opt(80), city: opt(80), state: opt(2),
  }).partial().default({}),
  emergency_contact: z.object({ name: opt(120), phone: opt(20), relation: opt(40) }).partial().default({}),
  anamnesis: z.record(z.union([z.string(), z.boolean()])).default({}).transform(cleanAnamnesis),
  consent: z.boolean().default(false),
});
export type PatientInput = z.input<typeof patientSchema>;

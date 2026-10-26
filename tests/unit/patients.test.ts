import { describe, expect, it } from "vitest";
import { ageFrom, cleanAnamnesis, formatCpf, formatPhone, healthAlerts, isValidCpf, patientSchema } from "@/lib/patients";

describe("ficha do paciente", () => {
  it("CPF: dígito verificador, sequência repetida e máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("idade e telefone", () => {
    const now = new Date(2026, 9, 26);
    expect(ageFrom("1990-10-27", now)).toBe(35);
    expect(ageFrom("1990-10-26", now)).toBe(36);
    expect(ageFrom("x", now)).toBeNull();
    expect(formatPhone("5561987298666")).toBe("(61) 98729-8666");
  });

  it("alertas de saúde só para o que pede atenção", () => {
    const a = cleanAnamnesis({ gestante: true, fumante: true, alergias: "Dipirona", inventado: "x", tipo_pele: "Marciana" });
    expect(a).toEqual({ gestante: true, fumante: true, alergias: "Dipirona" });
    expect(healthAlerts(a)).toEqual(["Alergia: Dipirona", "Gestante"]);
    expect(healthAlerts(cleanAnamnesis({ alergias: "Nenhuma" }))).toEqual([]);
  });

  it("validação: CPF inválido e e-mail errado são recusados; vazios viram nulos", () => {
    expect(patientSchema.safeParse({ name: "Ana Souza", cpf: "123.456.789-00" }).success).toBe(false);
    expect(patientSchema.safeParse({ name: "Ana Souza", email: "ana@" }).success).toBe(false);
    const ok = patientSchema.parse({ name: "  Ana Souza ", phone: "(61) 98729-8666", cpf: "529.982.247-25", email: "", birth_date: "" });
    expect(ok).toMatchObject({ name: "Ana Souza", phone: "61987298666", cpf: "52998224725", email: null, birth_date: null });
  });
});

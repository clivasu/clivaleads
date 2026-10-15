import { describe, expect, it } from "vitest";
import { autoBucket, dashQuery, resolveDashPeriod } from "@/lib/dashboard-period";

const NOW = new Date("2026-10-15T15:00:00Z"); // 15/10/2026 12h em Brasília

describe("período do Dashboard", () => {
  it("este mês: mês inteiro (para mostrar os próximos agendamentos), por dia", () => {
    const p = resolveDashPeriod({}, NOW);
    expect(p).toMatchObject({ key: "este-mes", de: "2026-10-01", ate: "2026-10-31", bucket: "day", from: "2026-10-01T03:00:00.000Z", to: "2026-11-01T03:00:00.000Z" });
    expect(p.compareLabel).toContain("set/2026");
  });
  it("últimos 15 dias incluem hoje", () => {
    expect(resolveDashPeriod({ periodo: "15d" }, NOW)).toMatchObject({ de: "2026-10-01", ate: "2026-10-15" });
  });
  it("mês passado", () => {
    expect(resolveDashPeriod({ periodo: "mes-passado" }, NOW)).toMatchObject({ de: "2026-09-01", ate: "2026-09-30", label: "Mês passado (set/2026)" });
  });
  it("personalizado: datas invertidas são corrigidas; inválidas voltam ao mês atual", () => {
    expect(resolveDashPeriod({ periodo: "personalizado", de: "2026-09-30", ate: "2026-08-01" }, NOW)).toMatchObject({ de: "2026-08-01", ate: "2026-09-30", bucket: "day" });
    expect(resolveDashPeriod({ periodo: "personalizado", de: "xx", ate: "2026-08-01" }, NOW).key).toBe("este-mes");
  });
  it("agrupamento automático e manual", () => {
    expect([autoBucket(31), autoBucket(200), autoBucket(1500)]).toEqual(["day", "month", "year"]);
    const p = resolveDashPeriod({ periodo: "personalizado", de: "2025-01-01", ate: "2026-10-15", agrupar: "year" }, NOW);
    expect(p).toMatchObject({ bucket: "year", bucketAuto: false });
  });
  it("URL", () => {
    expect(dashQuery({ periodo: "este-mes" })).toBe("");
    expect(dashQuery({ periodo: "personalizado", de: "2026-08-01", ate: "2026-08-31", agrupar: "day" })).toBe("periodo=personalizado&de=2026-08-01&ate=2026-08-31&agrupar=day");
  });
});

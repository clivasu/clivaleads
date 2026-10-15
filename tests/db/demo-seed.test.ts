import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { as, freshDb, signUp } from "./harness";

// Script de demonstração (supabase/seed/demo_dra_marina.sql): roda sobre a
// conta certa, gera os números prometidos e o script de remoção limpa tudo.
describe("demonstração Dra. Marina", () => {
  it("cria ecossistema completo, não duplica e remove sem sobras", async () => {
    const db = await freshDb();
    const owner = await signUp(db, "mamsbsb@icloud.com", "Marina");
    const other = await signUp(db, "outra@clinica.com");
    const seed = readFileSync("supabase/seed/demo_dra_marina.sql", "utf8");
    const t0 = Date.now();
    const summary = await db.exec(seed);
    console.log("seed em", Date.now() - t0, "ms", JSON.stringify(summary.at(-1)?.rows));

    const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;

    // 6 funis publicados, com etapas
    const flows = await one<{ slug: string; steps: number }>(`select f.slug, count(s.*)::int as steps from flows f join flow_steps s on s.flow_id = f.id where f.organization_id = $1 and f.status = 'published' group by 1 order by 1`, [owner.orgId]);
    expect(flows.map((f) => f.slug)).toEqual(["drenagem-linfatica", "limpeza-de-pele", "microagulhamento", "peeling-de-diamante", "roleta-da-sorte", "roleta-premiada"]);

    // mais de 200 leads por funil em cada mês completo (ago, set)
    const perMonth = await one<{ slug: string; m: string; n: number }>(`
      select f.slug, to_char(l.created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') as m, count(*)::int as n
      from lead_sessions l join flows f on f.id = l.flow_id where l.organization_id = $1 group by 1, 2 order by 1, 2`, [owner.orgId]);
    console.log("leads por funil/mês:", JSON.stringify(perMonth));
    for (const r of perMonth) expect(r.n).toBeGreaterThan(200);

    // todos com nome e telefone; nenhum anônimo
    const anon = await one<{ n: number }>(`select count(*)::int as n from lead_sessions where organization_id = $1 and (coalesce(name, '') = '' or coalesce(phone, '') = '')`, [owner.orgId]);
    expect(anon[0].n).toBe(0);

    // abandono progressivo nas etapas (mais visualizações que conclusões)
    const ov = await as(db, { role: "authenticated", userId: owner.userId }, async (q) => {
      const f = (await q<{ id: string }>(`select id from flows where slug = 'limpeza-de-pele' and organization_id = $1`, [owner.orgId])).rows[0].id;
      return (await q<{ o: { totals: Record<string, number>; steps: { views: number; completions: number }[] } }>(
        `select analytics_overview($1, '2026-08-01T03:00:00Z', now() + interval '1 day', $2) as o`, [owner.orgId, f])).rows[0].o;
    });
    expect(ov.totals.visits).toBeGreaterThan(ov.totals.starts);
    expect(ov.totals.starts).toBeGreaterThan(ov.totals.completions);
    expect(ov.totals.completions).toBeGreaterThan(ov.totals.whatsapp_clicks);
    expect(ov.totals.appointments).toBeGreaterThan(0);
    const views = ov.steps.map((s) => s.views);
    expect(views).toEqual([...views].sort((a, b) => b - a)); // cada etapa tem menos gente que a anterior
    console.log("limpeza de pele:", JSON.stringify(ov.totals));

    // agenda: só a Dra. Marina, sem domingos nem feriados, dias úteis lotados
    const ag = await one<{ profs: number; sundays: number; holidays: number; full_weekdays: number; weekdays: number }>(`
      with a as (select *, (starts_at at time zone 'America/Sao_Paulo') as l from schedule_appointments where organization_id = $1),
      d as (select l::date as day, count(*) as n from a where extract(isodow from l) between 1 and 5 group by 1)
      select (select count(distinct professional_id)::int from a) as profs,
             (select count(*)::int from a where extract(isodow from l) = 7) as sundays,
             (select count(*)::int from a where l::date in ('2026-09-07', '2026-10-12')) as holidays,
             (select count(*)::int from d where n = 9) as full_weekdays,
             (select count(*)::int from d) as weekdays`, [owner.orgId]);
    expect(ag[0]).toMatchObject({ profs: 1, sundays: 0, holidays: 0 });
    expect(ag[0].full_weekdays).toBe(ag[0].weekdays);

    // dashboard: receita mensal de agosto e KPIs
    const home = await as(db, { role: "authenticated", userId: owner.userId }, async (q) =>
      (await q<{ h: { kpis: Record<string, number>; months: { month: string; revenue_cents: number }[]; today: unknown[] } }>(`select dashboard_home($1) as h`, [owner.orgId])).rows[0].h);
    const aug = home.months.find((m) => m.month === "2026-08")!.revenue_cents / 100;
    console.log("receita agosto R$", aug, "kpis", JSON.stringify(home.kpis));
    expect(aug).toBeGreaterThan(40000);
    expect(aug).toBeLessThan(75000);
    expect(home.kpis.professionals).toBe(1);

    // dashboard por período: soma da série = faturamento; agosto inteiro por mês
    const per = await as(db, { role: "authenticated", userId: owner.userId }, async (q) =>
      (await q<{ p: { kpis: Record<string, number>; series: { bucket: string; revenue_cents: number | null; done: number | null }[]; donut: Record<string, number> } }>(
        `select dashboard_period($1, '2026-08-01T03:00:00Z', '2026-09-01T03:00:00Z', 'day') as p`, [owner.orgId])).rows[0].p);
    expect(per.series.length).toBe(31);
    expect(per.series.reduce((a, x) => a + (x.revenue_cents ?? 0), 0)).toBe(per.kpis.revenue_cents);
    expect(per.kpis.revenue_cents / 100).toBe(aug);
    expect(per.series.find((x) => x.bucket === "2026-08-02")!.done).toBe(0); // domingo
    const yr = await as(db, { role: "authenticated", userId: owner.userId }, async (q) =>
      (await q<{ p: { series: { bucket: string; revenue_cents: number | null }[] } }>(
        `select dashboard_period($1, '2026-01-01T03:00:00Z', '2027-01-01T03:00:00Z', 'month') as p`, [owner.orgId])).rows[0].p);
    expect(yr.series.map((x) => x.bucket.slice(0, 7))).toContain("2026-08");
    expect(yr.series.find((x) => x.bucket.startsWith("2026-12"))!.revenue_cents).toBeNull(); // futuro: linha para hoje

    // outra clínica não enxerga o dashboard da Dra. Marina, nem pedindo o id
    const spy = await as(db, { role: "authenticated", userId: other.userId }, async (q) =>
      (await q<{ h: { kpis: Record<string, number>; today: unknown[] } }>(`select dashboard_home($1) as h`, [owner.orgId])).rows[0].h);
    expect(spy.kpis).toMatchObject({ patients: 0, appointments: 0, revenue_cents: 0 });
    expect(spy.today).toEqual([]);
    const spyPer = await as(db, { role: "authenticated", userId: other.userId }, async (q) =>
      (await q<{ p: { kpis: Record<string, number> } }>(`select dashboard_period($1, '2026-08-01T03:00:00Z', '2026-09-01T03:00:00Z') as p`, [owner.orgId])).rows[0].p);
    expect(spyPer.kpis).toMatchObject({ revenue_cents: 0, appointments: 0 });

    // outra clínica intacta
    const otherRows = await one<{ n: number }>(`select (select count(*) from flows where organization_id = $1) + (select count(*) from schedule_appointments where organization_id = $1) as n`, [other.orgId]);
    expect(Number(otherRows[0].n)).toBe(0);

    // rodar de novo não duplica
    await expect(db.exec(seed)).rejects.toThrow(/já existe/);

    // remoção limpa tudo
    await db.exec(readFileSync("supabase/seed/demo_dra_marina_remove.sql", "utf8"));
    const left = await one<{ n: number }>(`select (select count(*) from flows where organization_id = $1) + (select count(*) from lead_sessions where organization_id = $1)
      + (select count(*) from events where organization_id = $1) + (select count(*) from schedule_appointments where organization_id = $1)
      + (select count(*) from schedule_patients where organization_id = $1) + (select count(*) from schedule_professionals where organization_id = $1) as n`, [owner.orgId]);
    expect(Number(left[0].n)).toBe(0);
  }, 300_000);
});

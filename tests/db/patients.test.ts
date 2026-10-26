import { describe, expect, it } from "vitest";
import { as, asCommit, expectDenied, freshDb, signUp } from "./harness";

describe("0019 ficha do paciente e lead manual", () => {
  it("membro cria lead manual; não forja lead de funil nem em outra clínica", async () => {
    const db = await freshDb();
    const a = await signUp(db, "dona@a.com");
    const b = await signUp(db, "dona@b.com");
    const flow = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug, status) values ($1, 'F', 'f', 'published') returning id`, [a.orgId])).rows[0].id;

    const r = await asCommit(db, { role: "authenticated", userId: a.userId }, (q) =>
      q(`insert into lead_sessions (session_id, organization_id, source, name, phone, score, status) values ('manual-1', $1, 'manual', 'Ana Indicação', '61999990000', 45, 'new') returning id`, [a.orgId]));
    expect(r.rows.length).toBe(1);

    expect((await expectDenied(as(db, { role: "authenticated", userId: a.userId }, (q) =>
      q(`insert into lead_sessions (session_id, organization_id, flow_id, source, name, score) values ('x', $1, $2, 'funnel', 'Falso', 99)`, [a.orgId, flow])))).denied).toBe(true);
    expect((await expectDenied(as(db, { role: "authenticated", userId: b.userId }, (q) =>
      q(`insert into lead_sessions (session_id, organization_id, source, name, score) values ('x', $1, 'manual', 'Intruso', 1)`, [a.orgId])))).denied).toBe(true);
  });

  it("lead manual fica fora das métricas do funil", async () => {
    const db = await freshDb();
    const a = await signUp(db, "dona@a.com");
    const flow = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug, status) values ($1, 'F', 'f', 'published') returning id`, [a.orgId])).rows[0].id;
    await db.query(`insert into lead_sessions (session_id, flow_id, organization_id, score) values ('s1', $1, $2, 70)`, [flow, a.orgId]);
    await db.query(`insert into lead_sessions (session_id, organization_id, source, name, score) values ('manual-1', $1, 'manual', 'Ana', 80)`, [a.orgId]);
    const o = await as(db, { role: "authenticated", userId: a.userId }, async (q) =>
      (await q<{ o: { totals: Record<string, number> } }>(`select analytics_overview($1, now() - interval '1 day', now() + interval '1 day') as o`, [a.orgId])).rows[0].o);
    expect(o.totals.leads).toBe(1);
  });

  it("ficha: CPF único por clínica, formato validado, dados só para a própria clínica", async () => {
    const db = await freshDb();
    const a = await signUp(db, "dona@a.com");
    const b = await signUp(db, "dona@b.com");
    const ins = (org: string, cpf: string) => db.query(
      `insert into schedule_patients (organization_id, name, cpf, anamnesis) values ($1, 'Paula', $2, '{"alergias":"Dipirona"}') returning id`, [org, cpf]);
    await ins(a.orgId, "52998224725");
    await expect(ins(a.orgId, "52998224725")).rejects.toThrow();
    await ins(b.orgId, "52998224725"); // outra clínica pode ter o mesmo paciente
    await expect(ins(a.orgId, "529.982.247-25")).rejects.toThrow(); // só dígitos
    const seen = await as(db, { role: "authenticated", userId: b.userId }, async (q) =>
      (await q<{ organization_id: string }>(`select organization_id from schedule_patients`)).rows);
    expect(seen.every((x) => x.organization_id === b.orgId)).toBe(true);
    const upd = await as(db, { role: "authenticated", userId: a.userId }, async (q) =>
      (await q<{ updated_at: string; created_at: string }>(`update schedule_patients set rg = '1234567' where organization_id = $1 returning updated_at, created_at`, [a.orgId])).rows[0]);
    expect(upd.updated_at >= upd.created_at).toBe(true);
  });
});

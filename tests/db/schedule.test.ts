import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, asCommit, expectDenied, freshDb, signUp } from "./harness";

// 2.4: agenda no banco (0012).
describe("2.4 agenda multi-clínica", () => {
  let db: PGlite;
  let a: { userId: string; orgId: string };
  let b: { userId: string; orgId: string };
  let profA: string;
  let profB: string;

  beforeAll(async () => {
    db = await freshDb();
    a = await signUp(db, "a@a.com");
    b = await signUp(db, "b@b.com");
    profA = (await asCommit(db, { role: "authenticated", userId: a.userId }, (q) =>
      q<{ id: string }>(`insert into schedule_professionals (organization_id, name) values ($1, 'Dra. Ana') returning id`, [a.orgId]))).rows[0].id;
    profB = (await asCommit(db, { role: "authenticated", userId: b.userId }, (q) =>
      q<{ id: string }>(`insert into schedule_professionals (organization_id, name) values ($1, 'Dr. Beto') returning id`, [b.orgId]))).rows[0].id;
    await asCommit(db, { role: "authenticated", userId: a.userId }, (q) =>
      q(`insert into schedule_appointments (organization_id, professional_id, patient_name, procedure_name, starts_at, ends_at)
         values ($1, $2, 'Paciente 1', 'Botox', '2026-10-20 10:00-03', '2026-10-20 11:00-03')`, [a.orgId, profA]));
  });

  const book = (who: { userId: string; orgId: string }, prof: string, s: string, e: string, status = "registered") =>
    as(db, { role: "authenticated", userId: who.userId }, (q) =>
      q(`insert into schedule_appointments (organization_id, professional_id, patient_name, procedure_name, starts_at, ends_at, status)
         values ($1, $2, 'X', 'Avaliação', $3, $4, $5) returning id`, [who.orgId, prof, s, e, status]));

  it("clínica B não vê nem altera a agenda da clínica A", async () => {
    const r = await as(db, { role: "authenticated", userId: b.userId }, async (q) => ({
      see: (await q(`select id from schedule_appointments where organization_id = $1`, [a.orgId])).rows.length,
      prof: (await q(`select id from schedule_professionals where id = $1`, [profA])).rows.length,
      upd: (await q(`update schedule_appointments set status = 'cancelled' where organization_id = $1 returning id`, [a.orgId])).rows.length,
    }));
    expect(r).toEqual({ see: 0, prof: 0, upd: 0 });
  });

  it("clínica B não cria agendamento na clínica A", async () => {
    const r = await expectDenied(book({ userId: b.userId, orgId: a.orgId }, profA, "2026-10-21 10:00-03", "2026-10-21 11:00-03"));
    expect(r.denied).toBe(true);
  });

  it("não aceita profissional de outra clínica no agendamento", async () => {
    const r = await expectDenied(book(a, profB, "2026-10-21 10:00-03", "2026-10-21 11:00-03"));
    expect(r.denied).toBe(true);
  });

  it("recusa horário sobreposto para o mesmo profissional", async () => {
    const r = await expectDenied(book(a, profA, "2026-10-20 10:30-03", "2026-10-20 11:30-03"));
    expect(r.error).toMatch(/schedule_no_overlap|conflicting key/);
  });

  it("aceita horário encostado (termina às 11h, outro começa às 11h)", async () => {
    const r = await book(a, profA, "2026-10-20 11:00-03", "2026-10-20 12:00-03");
    expect(r.rows.length).toBe(1);
  });

  it("agendamento cancelado não bloqueia o horário", async () => {
    const r = await as(db, { role: "authenticated", userId: a.userId }, async (q) => {
      await q(`update schedule_appointments set status = 'cancelled' where professional_id = $1`, [profA]);
      return q(`insert into schedule_appointments (organization_id, professional_id, patient_name, procedure_name, starts_at, ends_at)
                values ($1, $2, 'Y', 'Botox', '2026-10-20 10:00-03', '2026-10-20 11:00-03') returning id`, [a.orgId, profA]);
    });
    expect(r.rows.length).toBe(1);
  });

  it("atendente da clínica usa a agenda", async () => {
    const { rows } = await db.query<{ id: string }>(`insert into auth.users (email) values ('recepcao@a.com') returning id`);
    await db.query(`delete from organization_members where user_id = $1`, [rows[0].id]);
    await db.query(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'attendant')`, [a.orgId, rows[0].id]);
    const r = await book({ userId: rows[0].id, orgId: a.orgId }, profA, "2026-10-22 09:00-03", "2026-10-22 10:00-03");
    expect(r.rows.length).toBe(1);
  });

  it("visitante anônimo não acessa a agenda", async () => {
    const r = await expectDenied(as(db, { role: "anon" }, (q) => q(`select id from schedule_appointments`)));
    expect(r.denied).toBe(true);
  });

  it("remover profissional com histórico não apaga atendimentos (só desativa)", async () => {
    const del = await expectDenied(as(db, { role: "authenticated", userId: a.userId }, (q) =>
      q(`delete from schedule_professionals where id = $1 returning id`, [profA])));
    expect(del.denied).toBe(true); // restrict: tem agendamentos
    const off = await as(db, { role: "authenticated", userId: a.userId }, (q) =>
      q(`update schedule_professionals set active = false where id = $1 returning id`, [profA]));
    expect(off.rows.length).toBe(1);
  });
});

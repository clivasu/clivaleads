import { describe, expect, it } from "vitest";
import { as, expectDenied, freshDb, signUp } from "./harness";

describe("0018 agendamento online e notificações", () => {
  it("regras: membro lê, só owner/admin grava; outra clínica não vê", async () => {
    const db = await freshDb();
    const a = await signUp(db, "dona@a.com");
    const b = await signUp(db, "dona@b.com");
    const att = await signUp(db, "atendente@a.com");
    await db.query(`delete from organization_members where user_id = $1`, [att.userId]);
    await db.query(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'attendant')`, [a.orgId, att.userId]);

    const save = (userId: string) => as(db, { role: "authenticated", userId }, (q) =>
      q(`insert into schedule_booking_settings (organization_id, settings) values ($1, '{"enabled":true}') on conflict (organization_id) do update set settings = excluded.settings returning organization_id`, [a.orgId]));
    expect((await expectDenied(save(att.userId))).denied).toBe(true);
    expect((await expectDenied(save(b.userId))).denied).toBe(true);
    await db.query(`insert into schedule_booking_settings (organization_id, settings) values ($1, '{"enabled":true}')`, [a.orgId]);
    const read = (userId: string) => as(db, { role: "authenticated", userId }, async (q) => (await q(`select 1 from schedule_booking_settings`)).rows.length);
    expect(await read(att.userId)).toBe(1);
    expect(await read(b.userId)).toBe(0);
  });

  it("notificações: membro lê e marca como lida, mas não altera o texto; outra clínica não vê", async () => {
    const db = await freshDb();
    const a = await signUp(db, "dona@a.com");
    const b = await signUp(db, "dona@b.com");
    await db.query(`insert into notifications (organization_id, type, title) values ($1, 'booking.created', 'Novo agendamento: Ana')`, [a.orgId]);

    const mine = await as(db, { role: "authenticated", userId: a.userId }, async (q) => {
      await q(`update notifications set read_at = now()`);
      return (await q<{ read_at: string | null }>(`select read_at from notifications`)).rows;
    });
    expect(mine[0].read_at).not.toBeNull();
    await expect(as(db, { role: "authenticated", userId: a.userId }, (q) => q(`update notifications set title = 'x'`))).rejects.toThrow();
    expect((await expectDenied(as(db, { role: "authenticated", userId: a.userId }, (q) =>
      q(`insert into notifications (organization_id, type, title) values ($1, 'booking.created', 'falso')`, [a.orgId])))).denied).toBe(true);
    const other = await as(db, { role: "authenticated", userId: b.userId }, async (q) => (await q(`select 1 from notifications`)).rows.length);
    expect(other).toBe(0);
  });

  it("mesmo pedido (booking_ref) não cria dois agendamentos; horário ocupado é recusado", async () => {
    const db = await freshDb();
    const a = await signUp(db, "dona@a.com");
    const pro = (await db.query<{ id: string }>(`insert into schedule_professionals (organization_id, name) values ($1, 'Dra. Marina') returning id`, [a.orgId])).rows[0].id;
    const ins = (ref: string | null, start: string) => db.query(
      `insert into schedule_appointments (organization_id, professional_id, patient_name, procedure_name, starts_at, ends_at, source, booking_ref)
       values ($1, $2, 'Ana', 'Limpeza de pele', $3::timestamptz, $3::timestamptz + interval '1 hour', 'funnel', $4)`, [a.orgId, pro, start, ref]);
    await ins("ref-1", "2026-10-23T17:00:00Z");
    await expect(ins("ref-1", "2026-10-24T17:00:00Z")).rejects.toThrow(/booking_ref|duplicate|unique/i);
    await expect(ins("ref-2", "2026-10-23T17:30:00Z")).rejects.toThrow(/schedule_no_overlap|exclusion|conflict/i);
    await ins("ref-3", "2026-10-23T18:00:00Z"); // logo depois: livre
    const n = (await db.query<{ n: number }>(`select count(*)::int as n from schedule_appointments where source = 'funnel'`)).rows[0].n;
    expect(n).toBe(2);
  });
});

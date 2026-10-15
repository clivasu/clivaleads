import { describe, expect, it } from "vitest";
import { as, asCommit, expectDenied, freshDb, signUp } from "./harness";

describe("0015 entregas de webhook", () => {
  it("só owner/admin da própria clínica leem; cliente não grava; um lead = uma entrega", async () => {
    const db = await freshDb();
    const a = await signUp(db, "dona@a.com");
    const b = await signUp(db, "dona@b.com");
    const att = await signUp(db, "atendente@a.com");
    // atendente da clínica A (vínculo criado pelo servidor)
    await db.query(`delete from organization_members where user_id = $1`, [att.userId]);
    await db.query(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'attendant')`, [a.orgId, att.userId]);

    const flow = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug, status) values ($1, 'F', 'f', 'published') returning id`, [a.orgId])).rows[0].id;
    const lead = (await db.query<{ id: string }>(`insert into lead_sessions (session_id, flow_id, organization_id, score) values ('s', $1, $2, 50) returning id`, [flow, a.orgId])).rows[0].id;
    await db.query(`insert into webhook_deliveries (organization_id, flow_id, lead_session_id, event) values ($1, $2, $3, 'lead.created')`, [a.orgId, flow, lead]);
    await expect(db.query(`insert into webhook_deliveries (organization_id, flow_id, lead_session_id, event) values ($1, $2, $3, 'lead.created')`, [a.orgId, flow, lead])).rejects.toThrow();

    const read = (userId: string) => as(db, { role: "authenticated", userId }, async (q) => (await q(`select id from webhook_deliveries`)).rows.length);
    expect(await read(a.userId)).toBe(1);
    expect(await read(b.userId)).toBe(0);
    expect(await read(att.userId)).toBe(0);

    expect((await expectDenied(as(db, { role: "authenticated", userId: a.userId }, (q) =>
      q(`insert into webhook_deliveries (organization_id, flow_id, lead_session_id, event) values ($1, $2, null, 'lead.created')`, [a.orgId, flow])))).denied).toBe(true);
    expect((await expectDenied(as(db, { role: "authenticated", userId: a.userId }, (q) => q(`update webhook_deliveries set status = 'delivered'`)))).denied).toBe(true);
    expect((await as(db, { role: "anon" }, async (q) => (await q(`select id from webhook_deliveries`).catch(() => ({ rows: [] }))).rows.length))).toBe(0);
  });

  it("dono lê a opção de incluir respostas, mas nunca o segredo", async () => {
    const db = await freshDb();
    const a = await signUp(db, "x@a.com");
    const flow = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug) values ($1, 'F', 'f') returning id`, [a.orgId])).rows[0].id;
    await db.query(`insert into flow_private_settings (flow_id, organization_id, webhook_url, webhook_secret, webhook_include_answers) values ($1, $2, 'https://crm.com/h', 'whsec_x', true)`, [flow, a.orgId]);
    const r = await asCommit(db, { role: "authenticated", userId: a.userId }, async (q) => (await q<{ webhook_include_answers: boolean }>(`select webhook_include_answers from flow_private_settings`)).rows);
    expect(r).toEqual([{ webhook_include_answers: true }]);
    await expect(as(db, { role: "authenticated", userId: a.userId }, (q) => q(`select webhook_secret from flow_private_settings`))).rejects.toThrow();
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, expectDenied, freshDb, signUp } from "./harness";

// Entrega B: save atômico do funil (0011) e exclusão de lead.
describe("2.1 save_flow atômico", () => {
  let db: PGlite;
  let owner: { userId: string; orgId: string };
  let other: { userId: string; orgId: string };
  let flowId: string;
  const S1 = "aaaaaaaa-0000-4000-8000-000000000001";
  const S2 = "aaaaaaaa-0000-4000-8000-000000000002";

  beforeAll(async () => {
    db = await freshDb();
    owner = await signUp(db, "dono@a.com");
    other = await signUp(db, "outro@b.com");
    const { rows } = await db.query<{ id: string }>(
      `insert into flows (organization_id, name, slug, status) values ($1, 'Original', 'original', 'draft') returning id`, [owner.orgId]);
    flowId = rows[0].id;
    await db.query(`insert into flow_steps (id, flow_id, position, type, config) values ($1, $3, 0, 'start', '{"title":"A"}'), ($2, $3, 1, 'question', '{"title":"B"}')`, [S1, S2, flowId]);
  });

  const steps = async () => (await db.query<{ id: string; type: string }>(`select id, type from flow_steps where flow_id = $1 order by position`, [flowId])).rows;

  it("erro numa etapa desfaz tudo: etapas e funil anteriores ficam intactos", async () => {
    const r = await expectDenied(as(db, { role: "authenticated", userId: owner.userId }, (q) =>
      q(`select save_flow($1, $2, $3)`, [flowId, JSON.stringify({ name: "Novo nome" }),
        JSON.stringify([{ id: S1, position: 0, type: "start", config: {} }, { position: 1, type: null, config: {} }])])));
    expect(r.error).toBeTruthy();
    expect(await steps()).toEqual([{ id: S1, type: "start" }, { id: S2, type: "question" }]);
    const { rows } = await db.query<{ name: string }>(`select name from flows where id = $1`, [flowId]);
    expect(rows[0].name).toBe("Original");
  });

  it("save válido troca as etapas mantendo os ids enviados", async () => {
    const NEW = "aaaaaaaa-0000-4000-8000-000000000003";
    await as(db, { role: "authenticated", userId: owner.userId }, async (q) => {
      await q(`select save_flow($1, $2, $3)`, [flowId, JSON.stringify({ name: "Salvo", status: "published", settings: { seoTitle: "x" } }),
        JSON.stringify([{ id: S2, position: 0, type: "question", config: { title: "B" } }, { id: NEW, position: 1, type: "whatsapp", config: {} }])]);
      const r = await q<{ id: string }>(`select id from flow_steps where flow_id = $1 order by position`, [flowId]);
      expect(r.rows.map((x) => x.id)).toEqual([S2, NEW]);
      const f = await q<{ name: string; status: string }>(`select name, status from flows where id = $1`, [flowId]);
      expect(f.rows[0]).toEqual({ name: "Salvo", status: "published" });
    });
  });

  it("outra clínica não salva o funil", async () => {
    const r = await expectDenied(as(db, { role: "authenticated", userId: other.userId }, (q) =>
      q(`select save_flow($1, '{}'::jsonb, '[]'::jsonb)`, [flowId])));
    expect(r.error).toMatch(/permissão/);
    expect((await steps()).length).toBe(2);
  });

  it("anônimo não executa a função", async () => {
    const r = await expectDenied(as(db, { role: "anon" }, (q) => q(`select save_flow($1, '{}'::jsonb, '[]'::jsonb)`, [flowId])));
    expect(r.denied).toBe(true);
  });
});

describe("2.3 excluir lead", () => {
  let db: PGlite;
  let a: { userId: string; orgId: string };
  let b: { userId: string; orgId: string };
  let leadId: string;

  beforeAll(async () => {
    db = await freshDb();
    a = await signUp(db, "a@a.com");
    b = await signUp(db, "b@b.com");
    const f = await db.query<{ id: string }>(`insert into flows (organization_id, name, slug, status) values ($1, 'F', 'f', 'published') returning id`, [a.orgId]);
    const l = await db.query<{ id: string }>(`insert into lead_sessions (session_id, flow_id, organization_id, name) values ('s', $1, $2, 'P') returning id`, [f.rows[0].id, a.orgId]);
    leadId = l.rows[0].id;
    await db.query(`insert into lead_answers (lead_session_id, organization_id, question_title, answer_value, answer_label) values ($1, $2, 'q', 'v', 'l')`, [leadId, a.orgId]);
  });

  it("outra clínica não apaga o lead", async () => {
    const r = await as(db, { role: "authenticated", userId: b.userId }, (q) => q(`delete from lead_sessions where id = $1 returning id`, [leadId]));
    expect(r.rows.length).toBe(0);
  });

  it("dono apaga o lead e as respostas saem junto", async () => {
    const r = await as(db, { role: "authenticated", userId: a.userId }, async (q) => {
      const del = await q(`delete from lead_sessions where id = $1 returning id`, [leadId]);
      const ans = await q(`select id from lead_answers where lead_session_id = $1`, [leadId]);
      return { del: del.rows.length, ans: ans.rows.length };
    });
    expect(r).toEqual({ del: 1, ans: 0 });
  });
});

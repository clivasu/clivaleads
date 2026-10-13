import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { as, asCommit, freshDb, runMigration, signUp } from "./harness";

// Entrega C: métricas calculadas no banco batem exatamente com os eventos.
// Cenário da clínica A, funil F (período 2026-10-01 a 2026-10-31):
//   v1: abre, começa, vê 3 etapas, conclui, abre o WhatsApp; lead quente com telefone; depois agendado
//   v2: abre e sai sem interagir (abandono antes de começar)
//   v3: abre, começa, vê 2 etapas, cai no "sem interesse"; lead frio
//   v4: abre, recarrega (2 visitas), começa, conclui pelo formulário final SEM WhatsApp; lead morno com e-mail
//   reenvio: o page_view de v1 chega duas vezes com o mesmo event_id (retry)
// Clínica B tem eventos no mesmo período e não pode contaminar A.
const T = (d: string) => `2026-10-${d}T15:00:00Z`;

describe("3 métricas do funil (analytics_overview)", () => {
  let db: PGlite;
  let a: { userId: string; orgId: string };
  let b: { userId: string; orgId: string };
  let flowA: string;
  let flowB: string;

  beforeAll(async () => {
    db = await freshDb();
    a = await signUp(db, "a@a.com");
    b = await signUp(db, "b@b.com");
    flowA = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug, status, procedure) values ($1, 'Botox', 'botox', 'published', 'Botox') returning id`, [a.orgId])).rows[0].id;
    flowB = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug, status) values ($1, 'B', 'b', 'published') returning id`, [b.orgId])).rows[0].id;

    // v1 chegou por um anúncio do Instagram (UTM gravada também nos eventos)
    const ev = (org: string, flow: string, sid: string, type: string, day: string, extra: { step?: number; eventId?: string } = {}) =>
      db.query(
        `insert into events (organization_id, flow_id, session_id, type, created_at, step_index, event_id, utm_source, utm_campaign)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict do nothing`,
        [org, flow, sid, type, T(day), extra.step ?? null, extra.eventId ?? null, sid === "v1" ? "instagram" : null, sid === "v1" ? "rino" : null],
      );
    const lead = async (sid: string, day: string, f: { score: number; phone?: string; email?: string; wa?: boolean; cta?: boolean; status?: string }) =>
      (await db.query<{ id: string }>(
        `insert into lead_sessions (session_id, flow_id, organization_id, score, phone, email, whatsapp_clicked, final_cta_clicked, status, procedure, created_at, utm_source, device, utm_campaign)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Botox', $10, $11, 'mobile', $12) returning id`,
        [sid, flowA, a.orgId, f.score, f.phone ?? null, f.email ?? null, f.wa ?? false, f.cta ?? false, f.status ?? "new", T(day), sid === "v1" ? "instagram" : null, sid === "v1" ? "rino" : null],
      )).rows[0].id;

    // v1
    await ev(a.orgId, flowA, "v1", "page_view", "05", { eventId: "aaaaaaaa-0000-4000-8000-000000000001" });
    await ev(a.orgId, flowA, "v1", "page_view", "05", { eventId: "aaaaaaaa-0000-4000-8000-000000000001" }); // retry duplicado
    await ev(a.orgId, flowA, "v1", "flow_started", "05");
    for (const i of [0, 1, 2]) await ev(a.orgId, flowA, "v1", "step_view", "05", { step: i });
    for (const i of [0, 1]) await ev(a.orgId, flowA, "v1", "step_completed", "05", { step: i });
    await ev(a.orgId, flowA, "v1", "flow_completed", "05");
    await ev(a.orgId, flowA, "v1", "whatsapp_clicked", "05");
    const l1 = await lead("v1", "05", { score: 70, phone: "61999990000", wa: true, status: "whatsapp" });
    // a clínica (membro, com RLS) marca como agendado: o banco grava appointment_booked
    const setStatus = (st: string) => asCommit(db, { role: "authenticated", userId: a.userId }, (q) => q(`update lead_sessions set status = $2 where id = $1`, [l1, st]));
    await setStatus("scheduled");
    // depois converte e volta para agendado: não conta um segundo agendamento
    await setStatus("converted");
    await setStatus("scheduled");
    await db.query(`update events set created_at = $1 where type = 'appointment_booked'`, [T("06")]);
    // v2
    await ev(a.orgId, flowA, "v2", "page_view", "06");
    // v3
    await ev(a.orgId, flowA, "v3", "page_view", "07");
    await ev(a.orgId, flowA, "v3", "flow_started", "07");
    for (const i of [0, 1]) await ev(a.orgId, flowA, "v3", "step_view", "07", { step: i });
    await ev(a.orgId, flowA, "v3", "step_completed", "07", { step: 0 });
    await ev(a.orgId, flowA, "v3", "flow_exited", "07");
    await lead("v3", "07", { score: 10, status: "lost" });
    // v4
    await ev(a.orgId, flowA, "v4", "page_view", "08");
    await ev(a.orgId, flowA, "v4", "page_view", "08");
    await ev(a.orgId, flowA, "v4", "flow_started", "08");
    await ev(a.orgId, flowA, "v4", "flow_completed", "08");
    await lead("v4", "08", { score: 40, email: "v4@x.com", cta: true });
    // fora do período
    await ev(a.orgId, flowA, "v9", "page_view", "01".replace("01", "01")).then(() =>
      db.query(`update events set created_at = '2026-09-30T23:00:00Z' where session_id = 'v9'`));
    // clínica B
    for (const t of ["page_view", "flow_started", "flow_completed", "whatsapp_clicked"]) await ev(b.orgId, flowB, "b1", t, "05");
  });

  type F = { procedure?: string; source?: string; campaign?: string };
  const overview = (userId: string, org: string, flow: string | null = null, bucket = "day", f: F = {}) =>
    as(db, { role: "authenticated", userId }, async (q) =>
      (await q<{ o: Record<string, unknown> }>(`select analytics_overview($1, $2, $3, $4, $5, $6, $7, $8) as o`,
        [org, "2026-10-01T03:00:00Z", "2026-11-01T03:00:00Z", flow, bucket, f.procedure ?? null, f.source ?? null, f.campaign ?? null])).rows[0].o);

  it("totais batem exatamente com o cenário", async () => {
    const o = await overview(a.userId, a.orgId);
    expect(o.totals).toEqual({
      visits: 5,              // v1 (retry ignorado), v2, v3, v4 x2
      unique_visitors: 4,
      starts: 3,              // v2 nunca começou
      completions: 2,         // v1 e v4 (v3 saiu: não é conclusão)
      exits: 1,
      whatsapp_clicks: 1,     // só v1; formulário final de v4 não conta
      appointments: 1,        // agendamento repetido do mesmo lead não conta 2x
      leads: 3,
      leads_with_contact: 2,  // v1 telefone, v4 e-mail
      qualified: 1, warm: 1, cold: 1,
      final_cta: 1,           // v4 concluiu pelo botão final
      leads_whatsapp: 1,
      devices_mobile: 3, devices_desktop: 0,
    });
  });

  it("série diária no fuso de Brasília", async () => {
    const o = await overview(a.userId, a.orgId);
    expect(o.series).toEqual([
      { bucket: "2026-10-05", visits: 1, starts: 1, completions: 1, whatsapp: 1, leads: 1 },
      { bucket: "2026-10-06", visits: 1, starts: 0, completions: 0, whatsapp: 0, leads: 0 },
      { bucket: "2026-10-07", visits: 1, starts: 1, completions: 0, whatsapp: 0, leads: 1 },
      { bucket: "2026-10-08", visits: 2, starts: 1, completions: 1, whatsapp: 0, leads: 1 },
    ]);
  });

  it("abandono por etapa (só com funil selecionado)", async () => {
    const o = await overview(a.userId, a.orgId, flowA);
    expect(o.steps).toEqual([
      { step_index: 0, step_id: null, views: 2, completions: 2 },
      { step_index: 1, step_id: null, views: 2, completions: 1 },
      { step_index: 2, step_id: null, views: 1, completions: 0 },
    ]);
    expect((await overview(a.userId, a.orgId)).steps).toEqual([]);
  });

  it("origem (UTM) e procedimento", async () => {
    const o = await overview(a.userId, a.orgId) as { sources: { source: string; leads: number }[]; procedures: { procedure: string; leads: number; advanced: number }[] };
    expect(o.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "(direto)", leads: 2 }),
      expect.objectContaining({ source: "instagram", leads: 1, whatsapp: 1, qualified: 1 }),
    ]));
    expect(o.procedures).toEqual([{ procedure: "Botox", leads: 3, whatsapp: 1, qualified: 1, advanced: 1 }]);
  });

  it("filtros de origem, campanha e procedimento valem para eventos e leads", async () => {
    const ig = await overview(a.userId, a.orgId, null, "day", { source: "instagram" }) as { totals: Record<string, number> };
    expect(ig.totals).toMatchObject({ visits: 1, starts: 1, completions: 1, whatsapp_clicks: 1, appointments: 1, leads: 1, qualified: 1 });
    const direct = await overview(a.userId, a.orgId, null, "day", { source: "(direto)" }) as { totals: Record<string, number> };
    expect(direct.totals).toMatchObject({ visits: 4, starts: 2, completions: 1, whatsapp_clicks: 0, appointments: 0, leads: 2 });
    const camp = await overview(a.userId, a.orgId, null, "day", { campaign: "rino" }) as { totals: Record<string, number> };
    expect(camp.totals.visits).toBe(1);
    const botox = await overview(a.userId, a.orgId, null, "day", { procedure: "Botox" }) as { totals: Record<string, number> };
    expect(botox.totals).toMatchObject({ visits: 5, leads: 3 });
    const none = await overview(a.userId, a.orgId, null, "day", { procedure: "Outro" }) as { totals: Record<string, number> };
    expect(none.totals).toMatchObject({ visits: 0, leads: 0 });
    const all = await overview(a.userId, a.orgId) as { filters: Record<string, string[]> };
    expect(all.filters).toEqual({ procedures: ["Botox"], sources: ["(direto)", "instagram"], campaigns: ["rino"] });
  });

  it("clínica B não enxerga números da A, nem pedindo o id da A", async () => {
    const o = await overview(b.userId, a.orgId) as { totals: Record<string, number>; by_flow: unknown[] };
    expect(o.totals.visits).toBe(0);
    expect(o.totals.leads).toBe(0);
    expect(o.by_flow).toEqual([]);
    const own = await overview(b.userId, b.orgId) as { totals: Record<string, number> };
    expect(own.totals).toMatchObject({ visits: 1, starts: 1, completions: 1, whatsapp_clicks: 1 });
  });

  it("agendamento é registrado pelo banco uma única vez por lead", async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from events where type = 'appointment_booked'`);
    expect(r.rows[0].n).toBe(1);
  });

  it("anônimo não executa a função", async () => {
    await expect(as(db, { role: "anon" }, (q) => q(`select analytics_overview($1, now() - interval '1 day', now())`, [a.orgId]))).rejects.toThrow();
  });

  it("respostas agregadas para o painel (sem trazer leads)", async () => {
    const lid = (await db.query<{ id: string }>(`select id from lead_sessions where session_id = 'v1'`)).rows[0].id;
    await db.query(`insert into lead_answers (lead_session_id, organization_id, question_title, answer_value, answer_label) values ($1, $2, 'Sexo', 'f', 'Feminino'), ($1, $2, 'Incômodo', 'testa', 'Rugas na testa')`, [lid, a.orgId]);
    const r = await as(db, { role: "authenticated", userId: a.userId }, (q) =>
      q<{ question_title: string; answer_label: string; total: number }>(`select * from analytics_answers($1, '2026-10-01T03:00:00Z', '2026-11-01T03:00:00Z', null, null, 'instagram')`, [a.orgId]));
    expect(r.rows.map((x) => [x.question_title, x.answer_label, Number(x.total)])).toEqual(expect.arrayContaining([["Sexo", "Feminino", 1], ["Incômodo", "Rugas na testa", 1]]));
  });
});

describe("3 migração 0013 sobre dados existentes", () => {
  it("aplica com eventos antigos gravados e o rollback mantém os dados", async () => {
    const db = await freshDb({ upTo: "0012_schedule.sql" });
    const a = await signUp(db, "old@a.com");
    const flow = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug, status) values ($1, 'F', 'f', 'published') returning id`, [a.orgId])).rows[0].id;
    for (const t of ["page_view", "flow_started", "question_viewed", "option_clicked", "flow_completed", "whatsapp_clicked"]) {
      await db.query(`insert into events (organization_id, flow_id, session_id, type) values ($1, $2, 's', $3)`, [a.orgId, flow, t]);
    }
    await db.query(`insert into lead_sessions (session_id, flow_id, organization_id, score, status) values ('s', $1, $2, 70, 'scheduled')`, [flow, a.orgId]);

    await runMigration(db, "0013_events.sql");
    // lead já agendado antes da 0013 não ganha evento retroativo
    expect((await db.query(`select 1 from events where type = 'appointment_booked'`)).rows.length).toBe(0);
    const before = (await db.query<{ n: number }>(`select count(*)::int as n from events`)).rows[0].n;
    expect(before).toBe(6);

    await db.exec(readFileSync(join(__dirname, "..", "..", "supabase", "rollback", "0013_events.rollback.sql"), "utf8"));
    expect((await db.query<{ n: number }>(`select count(*)::int as n from events`)).rows[0].n).toBe(6);
    expect((await db.query(`select 1 from pg_proc where proname in ('analytics_overview', 'analytics_answers', 'lead_sessions_appointment_event')`)).rows.length).toBe(0);
    // o código antigo continua gravando os tipos de sempre
    await db.query(`insert into events (organization_id, flow_id, type) values ($1, $2, 'page_view')`, [a.orgId, flow]);
  });
});

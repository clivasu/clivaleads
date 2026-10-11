import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, freshDb, signUp } from "./harness";

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

    const ev = (org: string, flow: string, sid: string, type: string, day: string, extra: { step?: number; eventId?: string } = {}) =>
      db.query(
        `insert into events (organization_id, flow_id, session_id, type, created_at, step_index, event_id)
         values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing`,
        [org, flow, sid, type, T(day), extra.step ?? null, extra.eventId ?? null],
      );
    const lead = async (sid: string, day: string, f: { score: number; phone?: string; email?: string; wa?: boolean; cta?: boolean; status?: string }) =>
      (await db.query<{ id: string }>(
        `insert into lead_sessions (session_id, flow_id, organization_id, score, phone, email, whatsapp_clicked, final_cta_clicked, status, procedure, created_at, utm_source, device)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Botox', $10, $11, 'mobile') returning id`,
        [sid, flowA, a.orgId, f.score, f.phone ?? null, f.email ?? null, f.wa ?? false, f.cta ?? false, f.status ?? "new", T(day), sid === "v1" ? "instagram" : null],
      )).rows[0].id;

    // v1
    await ev(a.orgId, flowA, "v1", "page_view", "05", { eventId: "aaaaaaaa-0000-4000-8000-000000000001" });
    await ev(a.orgId, flowA, "v1", "page_view", "05", { eventId: "aaaaaaaa-0000-4000-8000-000000000001" }); // retry duplicado
    await ev(a.orgId, flowA, "v1", "flow_started", "05");
    for (const i of [0, 1, 2]) await ev(a.orgId, flowA, "v1", "step_view", "05", { step: i });
    for (const i of [0, 1]) await ev(a.orgId, flowA, "v1", "step_completed", "05", { step: i });
    await ev(a.orgId, flowA, "v1", "flow_completed", "05");
    await ev(a.orgId, flowA, "v1", "whatsapp_clicked", "05");
    const l1 = await lead("v1", "05", { score: 70, phone: "61999990000", wa: true, status: "scheduled" });
    await db.query(`insert into events (organization_id, flow_id, session_id, type, created_at, lead_session_id) values ($1, $2, 'v1', 'appointment_booked', $3, $4)`, [a.orgId, flowA, T("06"), l1]);
    // segundo appointment_booked do mesmo lead (ex.: clínica marcou de novo) é recusado
    await db.query(`insert into events (organization_id, flow_id, session_id, type, created_at, lead_session_id) values ($1, $2, 'v1', 'appointment_booked', $3, $4) on conflict do nothing`, [a.orgId, flowA, T("07"), l1]);
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

  const overview = (userId: string, org: string, flow: string | null = null, bucket = "day") =>
    as(db, { role: "authenticated", userId }, async (q) =>
      (await q<{ o: Record<string, unknown> }>(`select analytics_overview($1, $2, $3, $4, $5) as o`,
        [org, "2026-10-01T03:00:00Z", "2026-11-01T03:00:00Z", flow, bucket])).rows[0].o);

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
      { step_index: 0, views: 2, completions: 2 },
      { step_index: 1, views: 2, completions: 1 },
      { step_index: 2, views: 1, completions: 0 },
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

  it("clínica B não enxerga números da A, nem pedindo o id da A", async () => {
    const o = await overview(b.userId, a.orgId) as { totals: Record<string, number>; by_flow: unknown[] };
    expect(o.totals.visits).toBe(0);
    expect(o.totals.leads).toBe(0);
    expect(o.by_flow).toEqual([]);
    const own = await overview(b.userId, b.orgId) as { totals: Record<string, number> };
    expect(own.totals).toMatchObject({ visits: 1, starts: 1, completions: 1, whatsapp_clicks: 1 });
  });

  it("anônimo não executa a função", async () => {
    await expect(as(db, { role: "anon" }, (q) => q(`select analytics_overview($1, now() - interval '1 day', now())`, [a.orgId]))).rejects.toThrow();
  });

  it("respostas agregadas para o painel (sem trazer leads)", async () => {
    const lid = (await db.query<{ id: string }>(`select id from lead_sessions where session_id = 'v1'`)).rows[0].id;
    await db.query(`insert into lead_answers (lead_session_id, organization_id, question_title, answer_value, answer_label) values ($1, $2, 'Sexo', 'f', 'Feminino'), ($1, $2, 'Incômodo', 'testa', 'Rugas na testa')`, [lid, a.orgId]);
    const r = await as(db, { role: "authenticated", userId: a.userId }, (q) =>
      q<{ question_title: string; answer_label: string; total: number }>(`select * from analytics_answers($1, '2026-10-01T03:00:00Z', '2026-11-01T03:00:00Z')`, [a.orgId]));
    expect(r.rows.map((x) => [x.question_title, x.answer_label, Number(x.total)])).toEqual(expect.arrayContaining([["Sexo", "Feminino", 1], ["Incômodo", "Rugas na testa", 1]]));
  });
});

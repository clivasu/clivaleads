import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { as, freshDb, signUp } from "./harness";
import { resolveGoto, lastMainIndex, nextLinear } from "@/lib/flow-logic";
import { prepareStepsForSave } from "@/lib/flow-persistence";
import { scoreAnswers, totalFrom } from "@/lib/security/scoring";
import { tierFromScore } from "@/lib/scoring";
import { toPublicConfig } from "@/lib/public-funnel-config";
import type { FlowStep, QuestionOption } from "@/lib/types";

const SEED = readFileSync("supabase/seed/funil_diagnostico_viviane.sql", "utf8");
const REMOVE = readFileSync("supabase/seed/funil_diagnostico_viviane_remove.sql", "utf8");
const PUBLISH = readFileSync("supabase/seed/funil_diagnostico_viviane_publicar.sql", "utf8");
const AVISO = "A equipe da Drª avaliará as respostas e entrará em contato se você for selecionado(a).";

describe("funil Checklist Consultório 20K", () => {
  it("cria só na conta certa, em rascunho, sem duplicar; caminhos e pontuação corretos", async () => {
    const db = await freshDb();
    const vivi = await signUp(db, "mamsbsb@icloud.com", "Dra Viviane");
    const other = await signUp(db, "outra@clinica.com");
    // estado parecido com o real: a demonstração já tem uma profissional
    await db.query(`insert into schedule_professionals (organization_id, name) values ($1, 'Dra. Marina')`, [vivi.orgId]);

    const summary = (await db.exec(SEED)).at(-1)!.rows as { item: string; valor: string }[];
    const get = (k: string) => summary.find((r) => r.item === k)?.valor;
    expect(get("etapas")).toBe("9");
    expect(get("profissional do agendamento")).toBe("Dra. Viviane");
    expect(get("funil")).toContain("draft");

    // Rodar de novo não duplica nada.
    await db.exec(SEED);
    const n = async (sql: string, p: unknown[] = []) => (await db.query<{ n: number }>(sql, p)).rows[0].n;
    expect(await n(`select count(*)::int n from flows where slug = 'checklist-consultorio-20k'`)).toBe(1);
    expect(await n(`select count(*)::int n from flow_steps s join flows f on f.id = s.flow_id where f.organization_id = $1`, [vivi.orgId])).toBe(9);
    expect(await n(`select count(*)::int n from schedule_professionals where organization_id = $1 and name = 'Dra. Viviane'`, [vivi.orgId])).toBe(1);
    expect(await n(`select count(*)::int n from schedule_procedures where organization_id = $1`, [vivi.orgId])).toBe(1);
    // Outra conta intocada.
    for (const t of ["flows", "schedule_professionals", "schedule_procedures"]) expect(await n(`select count(*)::int n from ${t} where organization_id = $1`, [other.orgId])).toBe(0);

    // Dona enxerga no painel; rascunho não aparece para o público; outra conta não vê.
    const see = (userId: string) => as(db, { role: "authenticated", userId }, async (q) => (await q(`select 1 from flows where slug = 'checklist-consultorio-20k'`)).rows.length);
    expect(await see(vivi.userId)).toBe(1);
    expect(await see(other.userId)).toBe(0);
    expect(await as(db, { role: "anon" }, async (q) => (await q(`select 1 from flows where slug = 'checklist-consultorio-20k'`)).rows.length)).toBe(0);

    const steps = (await db.query<FlowStep>(`select s.id, s.flow_id, s.position, s.type, s.config from flow_steps s join flows f on f.id = s.flow_id where f.organization_id = $1 order by s.position`, [vivi.orgId])).rows;
    expect(steps.map((s) => s.type)).toEqual(["start", "form", "question", "question", "question", "question", "gift", "gift", "booking"]);

    // Contato pedido antes do convite; o convite não aparece antes da 6ª etapa.
    expect(steps[1].config.fields!.map((f) => f.name)).toEqual(["name", "phone", "email", "instagram"]);
    expect(JSON.stringify(steps.slice(0, 5))).not.toMatch(/sess[ãa]o|mentoria/i);
    expect(steps[5].config.subtitle).toBe(AVISO);
    expect(steps[6].config.invite_note).toBe(AVISO);
    expect(steps[8].config.booking_success_body).toBe(AVISO);

    // Sim → PDF com convite; não → só PDF; os dois botões levam ao agendamento.
    const opt = (i: number, v: string) => steps[i].config.options!.find((o: QuestionOption) => o.value === v)!;
    expect(resolveGoto(steps, opt(5, "sim").goto)).toBe(6);
    expect(resolveGoto(steps, opt(5, "nao").goto)).toBe(7);
    expect(resolveGoto(steps, steps[6].config.invite_goto)).toBe(8);
    expect(resolveGoto(steps, steps[7].config.invite_goto)).toBe(8);
    expect(lastMainIndex(steps)).toBe(8);
    expect(nextLinear(steps, 4)).toBe(5);

    // Arquivos entregues existem no projeto.
    for (const f of [steps[0].config.image_url, steps[6].config.file_url, steps[6].config.image_url, steps[7].config.file_url]) expect(existsSync(`public${f}`)).toBe(true);

    // Interesse = Quente em qualquer combinação; sem interesse nunca é Quente.
    const opts = [2, 3, 4].map((i) => steps[i].config.options!);
    for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) for (const v of ["sim", "nao"]) {
      const answers = [a, b, c, opt(5, v)].map((o, k) => ({ question_title: steps[k + 2].config.title!, answer_value: o.value }));
      const tier = tierFromScore(totalFrom(scoreAnswers(steps, answers)));
      if (v === "sim") expect(tier).toBe("hot"); else expect(tier).not.toBe("hot");
    }

    // Salvar no editor não troca os ids nem quebra os desvios.
    const saved = prepareStepsForSave(steps);
    expect(saved.idMap).toEqual({});
    await as(db, { role: "authenticated", userId: vivi.userId }, async (q) => {
      const patch = { name: "Checklist", slug: "checklist-consultorio-20k", procedure: "Diagnóstico de carreira", description: null, status: "published", whatsapp_number: null, final_message: null, cover_image_url: null, settings: {} };
      await q(`select save_flow($1, $2, $3)`, [steps[0].flow_id, JSON.stringify(patch), JSON.stringify(saved.rows)]);
      const after = (await q<{ id: string; status: string }>(`select s.id, f.status from flow_steps s join flows f on f.id = s.flow_id where f.id = $1 order by s.position`, [steps[0].flow_id])).rows;
      expect(after.map((s) => s.id)).toEqual(steps.map((s) => s.id));
      expect(after[0].status).toBe("published");
    });

    // Remoção tira o funil e preserva a Agenda.
    await db.exec(REMOVE);
    expect(await n(`select count(*)::int n from flows where organization_id = $1`, [vivi.orgId])).toBe(0);
    expect(await n(`select count(*)::int n from schedule_professionals where organization_id = $1`, [vivi.orgId])).toBe(2);
  });

  it("reaproveita a profissional Viviane que já existir e recusa conta inexistente", async () => {
    const db = await freshDb();
    await expect(db.exec(SEED)).rejects.toThrow(/não encontrada/);
    await db.exec("rollback");
    const vivi = await signUp(db, "mamsbsb@icloud.com");
    const pro = (await db.query<{ id: string }>(`insert into schedule_professionals (organization_id, name) values ($1, 'Dra Viviane Franzoi') returning id`, [vivi.orgId])).rows[0].id;
    await db.exec(SEED);
    const r = (await db.query<{ p: string; n: number }>(`select s.config->>'booking_professional' p, (select count(*)::int from schedule_professionals where organization_id = $1) n from flow_steps s join flows f on f.id = s.flow_id where f.organization_id = $1 and s.type = 'booking'`, [vivi.orgId])).rows[0];
    expect(r).toEqual({ p: pro, n: 1 });
  });

  it("agendamento do lead: aparece na agenda, no lead e liga a ficha", async () => {
    const db = await freshDb();
    const vivi = await signUp(db, "mamsbsb@icloud.com");
    const other = await signUp(db, "outra@clinica.com");
    await db.exec(SEED);
    const f = (await db.query<{ flow: string; pro: string }>(`select f.id flow, s.config->>'booking_professional' pro from flows f join flow_steps s on s.flow_id = f.id and s.type = 'booking' where f.organization_id = $1`, [vivi.orgId])).rows[0];
    // mesmos comandos de app/api/sessions, app/api/booking e linkLead
    const lead = (await db.query<{ id: string }>(`insert into lead_sessions (session_id, flow_id, organization_id, name, phone, email, procedure, score, status) values ('s1', $1, $2, 'Ana Teste', '(61) 99999-8888', 'ana@x.com', 'Diagnóstico de carreira', 95, 'new') returning id`, [f.flow, vivi.orgId])).rows[0].id;
    const pat = (await db.query<{ id: string }>(`insert into schedule_patients (organization_id, name, phone) values ($1, 'Ana Teste', '61999998888') returning id`, [vivi.orgId])).rows[0].id;
    const ap = (await db.query<{ id: string }>(`insert into schedule_appointments (organization_id, professional_id, patient_id, patient_name, procedure_name, starts_at, ends_at, source, flow_id, booking_ref, status) values ($1, $2, $3, 'Ana Teste', 'Sessão gratuita de diagnóstico de carreira', '2026-12-01T13:00:00Z', '2026-12-01T14:00:00Z', 'funnel', $4, 'r1', 'registered') returning id`, [vivi.orgId, f.pro, pat, f.flow])).rows[0].id;
    await as(db, { role: "service_role" }, async (q) => {
      await q(`update schedule_appointments set lead_session_id = $1 where id = $2 and organization_id = $3 and lead_session_id is null`, [lead, ap, vivi.orgId]);
      await q(`update schedule_patients set lead_session_id = $1 where id = $2 and organization_id = $3 and lead_session_id is null`, [lead, pat, vivi.orgId]);
      await q(`update lead_sessions set status = 'scheduled' where id = $1`, [lead]);
      const view = async (userId: string) => {
        await q(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [userId]);
        await q(`set local role authenticated`);
        const rows = (await q<{ procedure_name: string; status: string }>(`select a.procedure_name, l.status from schedule_appointments a join lead_sessions l on l.id = a.lead_session_id join schedule_patients p on p.lead_session_id = l.id where a.lead_session_id = $1 and a.status <> 'cancelled'`, [lead])).rows;
        await q(`set local role service_role`);
        return rows;
      };
      expect(await view(vivi.userId)).toEqual([{ procedure_name: "Sessão gratuita de diagnóstico de carreira", status: "scheduled" }]);
      expect(await view(other.userId)).toEqual([]);
    });
  });

  it("publicar: sobe só conta de cortesia, aplica o dourado e respeita o limite", async () => {
    const db = await freshDb();
    const vivi = await signUp(db, "mamsbsb@icloud.com");
    const other = await signUp(db, "outra@clinica.com");
    await expect(db.exec(PUBLISH)).rejects.toThrow(/não encontrado/);
    await db.exec("rollback");
    await db.exec(SEED);
    for (let i = 0; i < 7; i++) await db.query(`insert into flows (organization_id, name, slug, status) values ($1, $2, $2, 'published')`, [vivi.orgId, `demo-${i}`]);
    const bill = (org: string, plan: string, status: string) => db.query(`insert into org_billing (organization_id, plan, status) values ($1, $2, $3) on conflict (organization_id) do update set plan = $2, status = $3`, [org, plan, status]);
    const flow = async () => (await db.query<{ status: string; settings: Record<string, unknown> }>(`select status, settings from flows where organization_id = $1 and slug = 'checklist-consultorio-20k'`, [vivi.orgId])).rows[0];
    await bill(other.orgId, "pro", "comp");

    // Conta que paga: plano intocado e nada publicado acima do limite.
    await bill(vivi.orgId, "pro", "active");
    await expect(db.exec(PUBLISH)).rejects.toThrow(/permite 5/);
    await db.exec("rollback");
    expect((await flow()).status).toBe("draft");

    // Cortesia (situação real): sobe para Elite e publica.
    await bill(vivi.orgId, "pro", "comp");
    const r = (await db.exec(PUBLISH)).at(-1)!.rows as Record<string, unknown>[];
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: "published", cor: "#946C28", plano: "elite (comp)", funis_publicados: 8 });
    const f = await flow();
    expect(f.settings.seoTitle).toBeTruthy(); // não perde as outras configurações
    expect(toPublicConfig(f.settings).theme).toEqual({ primaryColor: "#946C28", backgroundColor: "#FFFFFF", textColor: "#1F1A14", logoUrl: "/materiais/logo-by-vika.webp" });
    expect(existsSync("public/materiais/logo-by-vika.webp")).toBe(true);
    expect((await db.query(`select plan from org_billing where organization_id = $1`, [other.orgId])).rows[0]).toEqual({ plan: "pro" });
    // O público passa a ver o funil.
    const slug = (await db.query<{ slug: string }>(`select slug from organizations where id = $1`, [vivi.orgId])).rows[0].slug;
    expect(await as(db, { role: "anon" }, async (q) => (await q<{ r: unknown }>(`select public_funnel($1, 'checklist-consultorio-20k') r`, [slug])).rows[0].r)).not.toBeNull();
  });

  it("datas de dezembro: só o bloco de agendamento da Viviane muda", async () => {
    const db = await freshDb();
    const vivi = await signUp(db, "mamsbsb@icloud.com");
    const other = await signUp(db, "outra@clinica.com");
    const AGENDA = readFileSync("supabase/seed/agenda_viviane_dezembro.sql", "utf8");
    await expect(db.exec(AGENDA)).rejects.toThrow(/não encontrado/);
    await db.exec("rollback");
    await db.exec(SEED);
    // outra conta com funil de mesmo endereço não é tocada
    const f2 = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug) values ($1, 'X', 'checklist-consultorio-20k') returning id`, [other.orgId])).rows[0].id;
    await db.query(`insert into flow_steps (flow_id, position, type, config) values ($1, 0, 'booking', '{"title":"t"}')`, [f2]);
    let r!: Record<string, unknown>;
    for (let i = 0; i < 2; i++) r = (await db.exec(AGENDA)).at(-1)!.rows[0] as Record<string, unknown>;
    expect(r).toEqual({ modo: "dates", datas: 11, primeira: "2026-11-30", ultima: "2026-12-12", intervalo_min: "60" });
    const cfg = (await db.query<{ config: Record<string, unknown> }>(`select s.config from flow_steps s join flows f on f.id = s.flow_id where f.organization_id = $1 and s.type = 'booking'`, [vivi.orgId])).rows[0].config;
    expect(cfg.booking_procedure).toBe("Sessão gratuita de diagnóstico de carreira"); // o resto do bloco fica
    expect((await db.query<{ config: unknown }>(`select config from flow_steps where flow_id = $1`, [f2])).rows[0].config).toEqual({ title: "t" });
  });
});

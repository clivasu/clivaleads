import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, expectDenied, freshDb, runMigration, signUp } from "./harness";

// Cenário: duas clínicas (A e B), um funil publicado da B com segredo de
// webhook salvo no JSON público (como o editor fazia até a 0010) e um lead
// da B. Os mesmos ataques rodam antes e depois da migration 0010.
async function scenario(upTo: string) {
  const db = await freshDb({ upTo });
  const a = await signUp(db, "ana@clinica-a.com", "Ana");
  const b = await signUp(db, "bia@clinica-b.com", "Bia");
  const flow = await db.query<{ id: string }>(
    `insert into flows (organization_id, name, slug, status, settings)
     values ($1, 'Botox', 'botox', 'published',
             '{"seoTitle":"Botox","webhookUrl":"https://crm.exemplo/hook","webhookSecret":"whsec_segredo_b","headScripts":"<script>x()</script>","notifyEmail":"bia@clinica-b.com"}')
     returning id`,
    [b.orgId],
  );
  const flowB = flow.rows[0].id;
  await db.query(
    `insert into lead_sessions (session_id, flow_id, organization_id, name, phone, status)
     values ('s1', $1, $2, 'Paciente da B', '61999990000', 'new')`,
    [flowB, b.orgId],
  );
  await db.query(`insert into storage.objects (bucket_id, name) values ('media', $1), ('media', 'bio/antigo.png')`, [`${b.orgId}/img/capa.webp`]);
  return { db, a, b, flowB };
}

describe("ANTES da 0010: as falhas da auditoria se reproduzem", () => {
  let s: Awaited<ReturnType<typeof scenario>>;
  beforeAll(async () => { s = await scenario("0009_official_admin.sql"); });

  it("1.1 usuário comum consegue se tornar superadmin", async () => {
    const r = await as(s.db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`update profiles set is_super_admin = true where id = $1 returning id`, [s.a.userId]));
    expect(r.rows.length).toBe(1);
  });

  it("1.2 usuário A consegue se vincular à clínica B e ler os leads dela", async () => {
    const leads = await as(s.db, { role: "authenticated", userId: s.a.userId }, async (q) => {
      await q(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'owner')`, [s.b.orgId, s.a.userId]);
      return q(`select name from lead_sessions where organization_id = $1`, [s.b.orgId]);
    });
    expect(leads.rows.length).toBe(1);
  });

  it("1.3 usuário A consegue apagar arquivo da clínica B", async () => {
    const r = await as(s.db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`delete from storage.objects where name like $1 returning id`, [`${s.b.orgId}/%`]));
    expect(r.rows.length).toBe(1);
  });

  it("1.4 visitante anônimo lê o segredo do webhook do funil publicado", async () => {
    const r = await as(s.db, { role: "anon" }, (q) =>
      q<{ secret: string }>(`select settings->>'webhookSecret' as secret from flows where id = $1`, [s.flowB]));
    expect(r.rows[0].secret).toBe("whsec_segredo_b");
  });
});

describe("DEPOIS da 0010: falhas bloqueadas e uso legítimo preservado", () => {
  let s: Awaited<ReturnType<typeof scenario>>;
  let db: PGlite;
  beforeAll(async () => {
    s = await scenario("0009_official_admin.sql");
    await runMigration(s.db, "0010_security_hardening.sql"); // aplica sobre dados existentes
    db = s.db;
  });

  // 1.1 ---------------------------------------------------------------------
  it("1.1 usuário comum NÃO altera is_super_admin", async () => {
    const r = await expectDenied(as(db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`update profiles set is_super_admin = true where id = $1 returning id`, [s.a.userId])));
    expect(r.denied).toBe(true);
    const { rows } = await db.query<{ v: boolean }>(`select is_super_admin as v from profiles where id = $1`, [s.a.userId]);
    expect(rows[0].v).toBe(false);
  });

  it("1.1 usuário continua podendo mudar o próprio nome e foto", async () => {
    const r = await as(db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`update profiles set full_name = 'Ana Souza', avatar_url = 'https://x/a.webp' where id = $1 returning id`, [s.a.userId]));
    expect(r.rows.length).toBe(1);
  });

  it("1.1 o servidor (service_role) ainda consegue promover um admin", async () => {
    const r = await as(db, { role: "service_role" }, (q) =>
      q(`update profiles set is_super_admin = true where id = $1 returning id`, [s.a.userId]));
    expect(r.rows.length).toBe(1);
  });

  // 1.2 ---------------------------------------------------------------------
  it("1.2 usuário A NÃO se vincula à clínica B", async () => {
    const r = await expectDenied(as(db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'owner') returning id`, [s.b.orgId, s.a.userId])));
    expect(r.denied).toBe(true);
  });

  it("1.2 usuário A NÃO lê leads, funis privados nem dados da clínica B", async () => {
    const r = await as(db, { role: "authenticated", userId: s.a.userId }, async (q) => ({
      leads: (await q(`select id from lead_sessions where organization_id = $1`, [s.b.orgId])).rows.length,
      private: (await q(`select flow_id from flow_private_settings where organization_id = $1`, [s.b.orgId])).rows.length,
    }));
    expect(r).toEqual({ leads: 0, private: 0 });
  });

  it("1.2 usuário A NÃO cria clínica pelo cliente nem altera a clínica B", async () => {
    const ins = await expectDenied(as(db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`insert into organizations (name, slug) values ('Falsa', 'falsa') returning id`)));
    expect(ins.denied).toBe(true);
    const upd = await expectDenied(as(db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`update organizations set name = 'Hackeada' where id = $1 returning id`, [s.b.orgId])));
    expect(upd.denied).toBe(true);
  });

  it("1.2 dono continua editando a própria clínica e os próprios funis", async () => {
    const r = await as(db, { role: "authenticated", userId: s.b.userId }, async (q) => ({
      org: (await q(`update organizations set name = 'Clínica B' where id = $1 returning id`, [s.b.orgId])).rows.length,
      flow: (await q(`update flows set name = 'Botox 2' where id = $1 returning id`, [s.flowB])).rows.length,
      leads: (await q(`select id from lead_sessions where organization_id = $1`, [s.b.orgId])).rows.length,
    }));
    expect(r).toEqual({ org: 1, flow: 1, leads: 1 });
  });

  it("1.2 atendente lê a clínica e os leads, mas não edita funis nem a clínica", async () => {
    const att = await (async () => {
      const { rows } = await db.query<{ id: string }>(`insert into auth.users (email) values ('atendente@b.com') returning id`);
      // vínculo criado pelo servidor (service_role), como faria um convite
      await db.query(`delete from organization_members where user_id = $1`, [rows[0].id]);
      await db.query(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'attendant')`, [s.b.orgId, rows[0].id]);
      return rows[0].id;
    })();
    const r = await as(db, { role: "authenticated", userId: att }, async (q) => ({
      leads: (await q(`select id from lead_sessions where organization_id = $1`, [s.b.orgId])).rows.length,
      leadUpdate: (await q(`update lead_sessions set status = 'scheduled' where organization_id = $1 returning id`, [s.b.orgId])).rows.length,
      flowUpdate: (await q(`update flows set name = 'x' where id = $1 returning id`, [s.flowB])).rows.length,
      orgUpdate: (await q(`update organizations set name = 'x' where id = $1 returning id`, [s.b.orgId])).rows.length,
    }));
    expect(r).toEqual({ leads: 1, leadUpdate: 1, flowUpdate: 0, orgUpdate: 0 });
  });

  it("1.2 identificador reservado é recusado mesmo via API direta", async () => {
    for (const slug of ["admin", "login", "cliva"]) {
      const r = await expectDenied(as(db, { role: "authenticated", userId: s.b.userId }, (q) =>
        q(`update organizations set slug = $1 where id = $2 returning id`, [slug, s.b.orgId])));
      expect(r.denied, slug).toBe(true);
    }
  });

  it("1.2 lead não pode ser movido para outra clínica", async () => {
    const r = await expectDenied(as(db, { role: "authenticated", userId: s.b.userId }, (q) =>
      q(`update lead_sessions set organization_id = $1 where organization_id = $2 returning id`, [s.a.orgId, s.b.orgId])));
    expect(r.denied).toBe(true);
  });

  // 1.3 ---------------------------------------------------------------------
  it("1.3 usuário A NÃO envia, altera nem apaga arquivos da pasta da clínica B", async () => {
    const ins = await expectDenied(as(db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`insert into storage.objects (bucket_id, name) values ('media', $1) returning id`, [`${s.b.orgId}/img/x.webp`])));
    const del = await expectDenied(as(db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`delete from storage.objects where name like $1 returning id`, [`${s.b.orgId}/%`])));
    const legacy = await expectDenied(as(db, { role: "authenticated", userId: s.a.userId }, (q) =>
      q(`delete from storage.objects where name = 'bio/antigo.png' returning id`)));
    expect([ins.denied, del.denied, legacy.denied]).toEqual([true, true, true]);
  });

  it("1.3 usuário A envia e apaga arquivos na própria pasta", async () => {
    const r = await as(db, { role: "authenticated", userId: s.a.userId }, async (q) => ({
      ins: (await q(`insert into storage.objects (bucket_id, name) values ('media', $1) returning id`, [`${s.a.orgId}/img/y.webp`])).rows.length,
      del: (await q(`delete from storage.objects where name = $1 returning id`, [`${s.a.orgId}/img/y.webp`])).rows.length,
    }));
    expect(r).toEqual({ ins: 1, del: 1 });
  });

  it("1.3 arquivos antigos continuam com leitura pública", async () => {
    const r = await as(db, { role: "anon" }, (q) => q(`select name from storage.objects where name = 'bio/antigo.png'`));
    expect(r.rows.length).toBe(1);
  });

  it("1.3 bucket media limita tipo (sem SVG) e tamanho", async () => {
    const { rows } = await db.query<{ l: number; m: string[] }>(`select file_size_limit as l, allowed_mime_types as m from storage.buckets where id = 'media'`);
    expect(Number(rows[0].l)).toBe(52428800);
    expect(rows[0].m).not.toContain("image/svg+xml");
  });

  // 1.4 ---------------------------------------------------------------------
  it("1.4 segredo saiu do JSON público e foi preservado na tabela privada", async () => {
    const pub = await as(db, { role: "anon" }, (q) =>
      q<{ s: Record<string, unknown> }>(`select settings as s from flows where id = $1`, [s.flowB]));
    expect(pub.rows[0].s).toEqual({ seoTitle: "Botox" });
    const priv = await db.query<{ webhook_secret: string; head_scripts: string }>(
      `select webhook_secret, head_scripts from flow_private_settings where flow_id = $1`, [s.flowB]);
    expect(priv.rows[0]).toEqual({ webhook_secret: "whsec_segredo_b", head_scripts: "<script>x()</script>" });
  });

  it("1.4 anônimo não lê a tabela privada; nem o dono lê o segredo pelo cliente", async () => {
    const anon = await expectDenied(as(db, { role: "anon" }, (q) => q(`select * from flow_private_settings`)));
    expect(anon.denied).toBe(true);
    const owner = await expectDenied(as(db, { role: "authenticated", userId: s.b.userId }, (q) =>
      q(`select webhook_secret from flow_private_settings where flow_id = $1`, [s.flowB])));
    expect(owner.denied).toBe(true);
    const ok = await as(db, { role: "authenticated", userId: s.b.userId }, (q) =>
      q<{ webhook_url: string }>(`select webhook_url from flow_private_settings where flow_id = $1`, [s.flowB]));
    expect(ok.rows[0].webhook_url).toBe("https://crm.exemplo/hook");
  });

  it("1.4 cliente antigo que regrava segredo no JSON público é limpo pelo banco", async () => {
    const r = await as(db, { role: "authenticated", userId: s.b.userId }, (q) =>
      q<{ s: Record<string, unknown> }>(`update flows set settings = '{"seoTitle":"B","webhookSecret":"novo"}' where id = $1 returning settings as s`, [s.flowB]));
    expect(r.rows[0].s).toEqual({ seoTitle: "B" });
  });

  // onboarding -------------------------------------------------------------
  it("cadastro novo continua criando clínica e vínculo owner", async () => {
    const c = await signUp(db, "caio@clinica-c.com", "Caio");
    expect(c.orgId).toBeTruthy();
  });
});

describe("ROLLBACK da 0010", () => {
  it("devolve os valores privados ao JSON do funil sem perder dados", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const s = await scenario("0009_official_admin.sql");
    await runMigration(s.db, "0010_security_hardening.sql");
    await s.db.exec(readFileSync(join(__dirname, "..", "..", "supabase", "rollback", "0010_security_hardening.rollback.sql"), "utf8"));
    const { rows } = await s.db.query<{ v: string }>(`select settings->>'webhookSecret' as v from flows where id = $1`, [s.flowB]);
    expect(rows[0].v).toBe("whsec_segredo_b");
    const leads = await s.db.query(`select id from lead_sessions`);
    expect(leads.rows.length).toBe(1);
  });
});

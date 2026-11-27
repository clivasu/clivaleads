import { describe, expect, it } from "vitest";
import { as, freshDb, signUp } from "./harness";

// 0020: o público abre só o que tem o endereço exato. Nada de listar
// clínicas, funis, bios ou arquivos de outras contas pela API.
describe("0020 acesso público", () => {
  async function setup() {
    const db = await freshDb();
    const a = await signUp(db, "dona@a.com");
    const b = await signUp(db, "dona@b.com");
    await db.query(`update organizations set slug = 'clinica-a', whatsapp_number = '5561999990000' where id = $1`, [a.orgId]);
    await db.query(`update organizations set slug = 'clinica-b' where id = $1`, [b.orgId]);
    const f = (await db.query<{ id: string }>(`insert into flows (organization_id, name, slug, status, settings) values ($1, 'Pele', 'pele', 'published', '{"seoTitle":"x"}') returning id`, [a.orgId])).rows[0].id;
    await db.query(`insert into flow_steps (flow_id, position, type, config) values ($1, 1, 'question', '{"title":"Q2"}'), ($1, 0, 'start', '{"title":"Q1"}')`, [f]);
    await db.query(`insert into flows (organization_id, name, slug, status) values ($1, 'Rascunho', 'rascunho', 'draft')`, [a.orgId]);
    await db.query(`insert into bio_pages (organization_id, status, config) values ($1, 'published', '{"name":"Clínica A"}')`, [a.orgId]);
    await db.query(`insert into bio_pages (organization_id, status, config) values ($1, 'draft', '{"name":"B"}')`, [b.orgId]);
    return { db, a, b, f };
  }

  it("visitante e usuário de outra clínica não listam clínicas, funis, etapas nem bios", async () => {
    const { db, b } = await setup();
    for (const who of [{ role: "anon" as const }, { role: "authenticated" as const, userId: b.userId }]) {
      const counts = await as(db, who, async (q) => {
        const n = async (t: string) => (await q<{ n: number }>(`select count(*)::int n from ${t}`)).rows[0].n;
        return { orgs: await n("organizations"), flows: await n("flows where status = 'published'"), steps: await n("flow_steps s join flows f on f.id = s.flow_id where f.status = 'published'"), bios: await n("bio_pages where status = 'published'") };
      });
      // o usuário da clínica B vê só a própria clínica (sem nada publicado)
      expect(counts).toEqual(who.role === "anon" ? { orgs: 0, flows: 0, steps: 0, bios: 0 } : { orgs: 1, flows: 0, steps: 0, bios: 0 });
    }
  });

  it("dona continua vendo tudo da própria clínica", async () => {
    const { db, a } = await setup();
    const r = await as(db, { role: "authenticated", userId: a.userId }, async (q) => (await q<{ n: number }>(`select count(*)::int n from flows`)).rows[0].n);
    expect(r).toBe(2);
  });

  it("funil abre pelo endereço exato, só publicado, com etapas em ordem", async () => {
    const { db, a, f } = await setup();
    const call = (h: string, s: string) => as(db, { role: "anon" }, async (q) => (await q<{ r: Record<string, never> | null }>(`select public_funnel($1, $2) r`, [h, s])).rows[0].r);
    const r = await call("clinica-a", "pele") as unknown as { flow: { id: string; status: string }; settings: { seoTitle: string }; organization: Record<string, unknown>; steps: { config: { title: string } }[] };
    expect(r.flow).toMatchObject({ id: f, status: "published" });
    expect(r.settings.seoTitle).toBe("x");
    expect(r.steps.map((s) => s.config.title)).toEqual(["Q1", "Q2"]);
    expect(Object.keys(r.organization).sort()).toEqual(["default_message", "id", "instagram", "logo_url", "name", "primary_color", "slug", "whatsapp_number"]);
    expect(r.organization.id).toBe(a.orgId);
    expect(await call("clinica-a", "rascunho")).toBeNull();
    expect(await call("clinica-b", "pele")).toBeNull(); // funil de outra conta não abre por outro identificador
    expect(await call("clinica-a", "nao-existe")).toBeNull();
  });

  it("bio só publicada; link antigo resolve para o endereço novo", async () => {
    const { db } = await setup();
    const r = await as(db, { role: "anon" }, async (q) => ({
      a: (await q<{ r: { config: { name: string } } | null }>(`select public_bio('clinica-a') r`)).rows[0].r,
      b: (await q<{ r: unknown }>(`select public_bio('clinica-b') r`)).rows[0].r,
      legacy: (await q<{ r: string | null }>(`select public_legacy_path('pele') r`)).rows[0].r,
      draft: (await q<{ r: string | null }>(`select public_legacy_path('rascunho') r`)).rows[0].r,
    }));
    expect(r.a?.config.name).toBe("Clínica A");
    expect(r.b).toBeNull();
    expect(r.legacy).toBe("/clinica-a/pele");
    expect(r.draft).toBeNull();
  });

  it("arquivos: cada clínica lista só os seus; visitante não lista nada", async () => {
    const { db, a, b } = await setup();
    await db.query(`insert into storage.objects (bucket_id, name) values ('media', $1), ('media', $2)`, [`${a.orgId}/img/1.jpg`, `${b.orgId}/img/2.jpg`]);
    const list = (who: Parameters<typeof as>[1]) => as(db, who, async (q) => (await q<{ name: string }>(`select name from storage.objects where bucket_id = 'media'`)).rows.map((r) => r.name));
    expect(await list({ role: "anon" })).toEqual([]);
    expect(await list({ role: "authenticated", userId: a.userId })).toEqual([`${a.orgId}/img/1.jpg`]);
  });
});

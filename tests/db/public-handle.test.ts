import { describe, expect, it } from "vitest";
import { as, freshDb, signUp } from "./harness";

// cliva.me/<identificador>: o visitante (anon) precisa ler a clínica quando há
// algo publicado nela (funil ou Link na Bio), e só nesse caso.
describe("0014 página pública do identificador", () => {
  it("clínica com só a bio publicada aparece; sem nada publicado continua oculta", async () => {
    const db = await freshDb();
    const bio = await signUp(db, "bio@a.com");
    const funil = await signUp(db, "funil@b.com");
    const nada = await signUp(db, "nada@c.com");
    await db.query(`insert into bio_pages (organization_id, status, config) values ($1, 'published', '{}')`, [bio.orgId]);
    await db.query(`insert into flows (organization_id, name, slug, status) values ($1, 'F', 'f', 'published')`, [funil.orgId]);
    await db.query(`insert into flows (organization_id, name, slug, status) values ($1, 'R', 'r', 'draft')`, [nada.orgId]);

    const visible = await as(db, { role: "anon" }, async (q) =>
      (await q<{ id: string }>(`select id from organizations`)).rows.map((r) => r.id));
    expect(visible).toContain(bio.orgId);
    expect(visible).toContain(funil.orgId);
    expect(visible).not.toContain(nada.orgId);
  });

  it("bio em rascunho não expõe a clínica", async () => {
    const db = await freshDb();
    const c = await signUp(db, "rasc@a.com");
    await db.query(`insert into bio_pages (organization_id, status, config) values ($1, 'draft', '{}')`, [c.orgId]);
    const rows = await as(db, { role: "anon" }, async (q) => (await q(`select id from organizations where id = $1`, [c.orgId])).rows);
    expect(rows).toEqual([]);
  });
});

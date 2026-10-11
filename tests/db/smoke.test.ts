import { describe, expect, it } from "vitest";
import { freshDb, signUp } from "./harness";

describe("ambiente de teste do banco", () => {
  it("aplica todas as migrations e o cadastro cria clínica + vínculo owner", async () => {
    const db = await freshDb();
    const a = await signUp(db, "ana@clinica-a.com", "Ana");
    expect(a.orgId).toBeTruthy();
    const { rows } = await db.query<{ role: string }>("select role from organization_members where user_id = $1", [a.userId]);
    expect(rows[0].role).toBe("owner");
  });
});

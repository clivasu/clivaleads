import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

// Banco Postgres real (PGlite, em memória) com o ambiente do Supabase
// imitado e TODAS as migrations do projeto aplicadas em ordem.
const ROOT = join(__dirname, "..", "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

export async function freshDb(opts: { upTo?: string } = {}) {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (opts.upTo && f > opts.upTo) break;
    const sql = stripUnavailable(readFileSync(join(MIGRATIONS, f), "utf8"));
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Falha ao aplicar ${f}: ${(e as Error).message}`);
    }
  }
  return db;
}

// pgcrypto não é necessário no teste: gen_random_uuid() é nativo desde o PG 13.
function stripUnavailable(sql: string) {
  return sql.replace(/create extension if not exists "?pgcrypto"?[^;]*;/gi, "");
}

export async function runMigration(db: PGlite, file: string) {
  const sql = stripUnavailable(readFileSync(join(MIGRATIONS, file), "utf8"));
  await db.exec(sql);
}

export type Who = { role: "anon" } | { role: "authenticated"; userId: string } | { role: "service_role" };

// Executa como um cliente do Supabase (papel + claims do JWT), dentro de uma
// transação que é sempre desfeita: um teste não contamina o outro.
export async function as<T>(db: PGlite, who: Who, fn: (q: PGlite["query"]) => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    const sub = who.role === "authenticated" ? who.userId : "";
    await db.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [sub, who.role]);
    await db.exec(`set local role ${who.role}`);
    return await fn(db.query.bind(db));
  } finally {
    await db.exec("rollback");
  }
}

// Igual ao `as`, mas confirma a transação (para preparar dados de teste).
export async function asCommit<T>(db: PGlite, who: Who, fn: (q: PGlite["query"]) => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    const sub = who.role === "authenticated" ? who.userId : "";
    await db.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [sub, who.role]);
    await db.exec(`set local role ${who.role}`);
    const r = await fn(db.query.bind(db));
    await db.exec("commit");
    return r;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}

// Cria um usuário pelo mesmo caminho do cadastro real (trigger on_auth_user_created).
export async function signUp(db: PGlite, email: string, fullName = "Teste") {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
    [email, fullName],
  );
  const userId = rows[0].id;
  const org = await db.query<{ organization_id: string }>(
    `select organization_id from public.organization_members where user_id = $1`,
    [userId],
  );
  return { userId, orgId: org.rows[0]?.organization_id as string };
}

// Espera que a operação seja recusada (erro de permissão/RLS) ou que não
// afete nenhuma linha.
export async function expectDenied(p: Promise<{ affectedRows?: number; rows: unknown[] }>) {
  try {
    const r = await p;
    return { denied: (r.affectedRows ?? r.rows.length) === 0, error: null as string | null };
  } catch (e) {
    return { denied: true, error: (e as Error).message };
  }
}

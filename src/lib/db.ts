import { Pool, type PoolClient } from "pg";

declare global {
  var __ckPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__ckPool) {
    global.__ckPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }
  return global.__ckPool;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

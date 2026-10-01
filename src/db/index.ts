import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type AppDb = NodePgDatabase<Record<string, never>>;

// ESLATMA: `next build` paytida Next.js route modullarini import qiladi
// ("Collecting page data ..." bosqichi). Agar bu fayl import paytida
// DATABASE_URL ni talab qilsa, build DATABASE_URL bo'lmaganda yiqiladi:
//   Error: Failed to collect page data for /api/health
// Shuning uchun Pool va drizzle faqat birinchi chaqiruvda (lazy) yaratiladi.

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: AppDb;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  return url;
}

// Lokal bazada SSL kerak emas, bulutli bazalarda (Neon, Supabase, Vercel Postgres) kerak
function isLocalHost(databaseUrl: string): boolean {
  try {
    const { hostname } = new URL(databaseUrl);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function getPool(): Pool {
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    const databaseUrl = getDatabaseUrl();
    const isServerless = !!process.env.VERCEL;

    globalForDb.__arenaNextJsPostgresqlPool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocalHost(databaseUrl) ? undefined : { rejectUnauthorized: false },
      // Serverless muhitda ulanishlar sonini kichik ushlaymiz
      max: isServerless ? 3 : 10,
      idleTimeoutMillis: isServerless ? 10_000 : 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  // Bir xil instance ichida qayta ishlatish (dev hot-reload va Vercel warm start)
  return globalForDb.__arenaNextJsPostgresqlPool;
}

export function getDb(): AppDb {
  if (!globalForDb.__arenaNextJsPostgresqlDb) {
    globalForDb.__arenaNextJsPostgresqlDb = drizzle(getPool());
  }
  return globalForDb.__arenaNextJsPostgresqlDb;
}

// `db` — lazy proxy: import qilish bazaga ulanmaydi, faqat
// db.select()/insert()/update()/delete()/execute() chaqirilganda ulanadi.
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
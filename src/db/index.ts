import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Lokal bazada SSL kerak emas, bulutli bazalarda (Neon, Supabase, Vercel Postgres) kerak
const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(databaseUrl);
const isServerless = !!process.env.VERCEL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    // Serverless muhitda ulanishlar sonini kichik ushlaymiz
    max: isServerless ? 3 : 10,
    idleTimeoutMillis: isServerless ? 10_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });

// Bir xil instance ichida qayta ishlatish (dev hot-reload va Vercel warm start)
globalForDb.__arenaNextJsPostgresqlPool = pool;

export const db = drizzle(pool);

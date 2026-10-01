import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Setup to'liqligini masofadan ham aniqlash uchun: baza ulanadimi + jadvallar
// yaratilganmi. `select 1` faqat ulanishni tekshiradi — jadvallar bo'lmasa ham
// yashil qoladi, shu sababli guruh/post tarqatish jimgina ishlamay qoladi.
const REQUIRED_TABLES = [
  "groups",
  "topics",
  "posts",
  "post_targets",
  "bot_admins",
  "bot_drafts",
  "clean_log",
];

export async function GET() {
  try {
    await db.execute(sql`select 1`);

    const { rows } = await db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ${sql.raw(
          `(${REQUIRED_TABLES.map((t) => `'${t}'`).join(", ")})`,
        )}
    `);
    const found = new Set(rows.map((r) => r.table_name));
    const missing = REQUIRED_TABLES.filter((t) => !found.has(t));

    if (missing.length > 0) {
      return Response.json(
        {
          ok: false,
          reason: "tables_missing",
          missing,
          hint: "DATABASE_URL bilan `npm run db:push` bajaring",
        },
        { status: 503 },
      );
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        reason: "db_unreachable",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}

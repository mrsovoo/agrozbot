import { db } from "@/db";
import { sql } from "drizzle-orm";
import { aiStatus } from "@/lib/agent/writer";

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
  "dialogs",
  "user_profiles",
];

// Jadvallar mavjud, lekin deploy'dagi kod yangiroq bo'lsa (yangi ustunlar
// qo'shilgan bo'lsa) so'rovlar "column does not exist" bilan yiqiladi.
// Buni ham oldindan aniqlaymiz — yechim bir xil: npm run db:push.
const REQUIRED_COLUMNS: { table: string; column: string }[] = [
  { table: "groups", column: "member_count" },
  { table: "groups", column: "bot_is_admin" },
  { table: "groups", column: "bot_can_delete" },
  { table: "bot_drafts", column: "session" },
];

const COLUMN_TABLES = [...new Set(REQUIRED_COLUMNS.map((c) => c.table))];

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
          check: "db+tables",
          reason: "tables_missing",
          missing,
          hint: "DATABASE_URL bilan `npm run db:push` bajaring",
        },
        { status: 503 },
      );
    }

    const colRes = await db.execute<{
      table_name: string;
      column_name: string;
    }>(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ${sql.raw(
          `(${COLUMN_TABLES.map((t) => `'${t}'`).join(", ")})`,
        )}
    `);
    const foundCols = new Set(
      colRes.rows.map((r) => `${r.table_name}.${r.column_name}`),
    );
    const missingColumns = REQUIRED_COLUMNS.filter(
      (c) => !foundCols.has(`${c.table}.${c.column}`),
    ).map((c) => `${c.table}.${c.column}`);

    if (missingColumns.length > 0) {
      return Response.json(
        {
          ok: false,
          check: "db+tables",
          reason: "schema_outdated",
          missingColumns,
          hint: "Yangi ustunlar uchun `npm run db:push` bajaring",
        },
        { status: 503 },
      );
    }

    return Response.json({ ok: true, check: "db+tables", ai: aiStatus() });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        check: "db+tables",
        reason: "db_unreachable",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}

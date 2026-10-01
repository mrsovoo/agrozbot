import { db } from "@/db";
import { groups, posts, cleanLog, postTargets } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import { sql, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const [activeGroupsCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(groups)
    .where(eq(groups.active, true));
  const [agroCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(groups)
    .where(sql`${groups.category} = 'agro' and ${groups.active} = true`);
  const [fermaCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(groups)
    .where(sql`${groups.category} = 'ferma' and ${groups.active} = true`);
  const [postsCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(posts);
  const [cleanedCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(cleanLog);
  const [sentCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(postTargets)
    .where(eq(postTargets.status, "sent"));

  return Response.json({
    groups: activeGroupsCount?.c ?? 0,
    agro: agroCount?.c ?? 0,
    ferma: fermaCount?.c ?? 0,
    posts: postsCount?.c ?? 0,
    cleaned: cleanedCount?.c ?? 0,
    delivered: sentCount?.c ?? 0,
  });
}

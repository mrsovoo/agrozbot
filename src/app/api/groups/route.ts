import { db } from "@/db";
import { groups, topics } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const groupRows = await db
    .select()
    .from(groups)
    .orderBy(desc(groups.active), groups.title);
  const topicRows = await db.select().from(topics);
  const withTopics = groupRows.map((g) => ({
    ...g,
    chatId: String(g.chatId),
    topics: topicRows
      .filter((t) => t.groupId === g.id)
      .map((t) => ({ ...t, threadId: String(t.threadId) })),
  }));
  return Response.json({ groups: withTopics });
}

// Guruhni qo'lda qo'shish (chat_id orqali)
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    chatId?: string;
    title?: string;
    category?: string;
  };
  const chatId = Number(body.chatId);
  if (!Number.isFinite(chatId) || chatId === 0) {
    return Response.json(
      { error: "To'g'ri chat ID kiriting" },
      { status: 400 },
    );
  }
  const existing = await db
    .select()
    .from(groups)
    .where(eq(groups.chatId, chatId));
  if (existing.length > 0) {
    return Response.json({ error: "Bu guruh allaqachon mavjud" }, { status: 400 });
  }
  const [created] = await db
    .insert(groups)
    .values({
      chatId,
      title: body.title?.trim() || "Guruh",
      category: body.category || "boshqa",
      active: true,
    })
    .returning();
  return Response.json({ group: { ...created, chatId: String(created.chatId) } });
}

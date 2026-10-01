import { db } from "@/db";
import { groups, topics } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import { tgGetChat } from "@/lib/telegram";
import { syncGroup } from "@/lib/groupMeta";
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
  // Telegram'dan chat ma'lumotlarini olishga urinamiz (bot a'zo bo'lsa ishlaydi) —
  // nom, username va forum ekanligini avtomatik to'ldiradi.
  const chatRes = await tgGetChat(chatId);
  const chat = chatRes.ok ? chatRes.result : undefined;

  const [created] = await db
    .insert(groups)
    .values({
      chatId,
      title: body.title?.trim() || chat?.title?.trim() || "Guruh",
      username: chat?.username ?? null,
      isForum: chat?.is_forum ?? false,
      category: body.category || "boshqa",
      active: true,
    })
    .returning();

  // A'zolar soni + bot admin holatini darhol o'qib qo'yamiz
  try {
    await syncGroup({ id: created.id, chatId: created.chatId });
  } catch {
    // meta olinmasa ham guruh qo'shilgan hisoblanadi
  }

  const [fresh] = await db.select().from(groups).where(eq(groups.id, created.id));
  return Response.json({
    group: { ...(fresh ?? created), chatId: String(created.chatId) },
    botInChat: chatRes.ok,
    warning: chatRes.ok
      ? null
      : "Bot bu guruhda topilmadi — a'zolar sonini olish uchun avval botni guruhga qo'shing.",
  });
}

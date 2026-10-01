import { db } from "@/db";
import { dialogs } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import { parseDialogMessages } from "@/lib/dialogs";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Fine-tuning xomashyosi ro'yxati.
// ?verified=true|false — filtr (default: hammasi), ?limit= N (default 100, max 500)
export async function GET(req: Request) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const verifiedParam = url.searchParams.get("verified");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 100, 1),
    500,
  );

  const where =
    verifiedParam === "true"
      ? eq(dialogs.verified, true)
      : verifiedParam === "false"
        ? eq(dialogs.verified, false)
        : undefined;

  const rows = await db
    .select()
    .from(dialogs)
    .where(where)
    .orderBy(desc(dialogs.createdAt))
    .limit(limit);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`count(*) filter (where ${dialogs.verified})::int`,
    })
    .from(dialogs);

  return Response.json({
    dialogs: rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      source: r.source,
      provider: r.provider,
      verified: r.verified,
      telegramUserId: r.telegramUserId,
      messages: r.messages,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    counts: { total: counts?.total ?? 0, verified: counts?.verified ?? 0 },
  });
}

// Yangi namunani qo'lda qo'shish (test / qo'lda yig'ish uchun)
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "noto'g'ri JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as {
    messages?: unknown;
    conversationId?: unknown;
    provider?: unknown;
    verified?: unknown;
  };

  const messages = parseDialogMessages(b.messages);
  if (!messages) {
    return Response.json(
      {
        error:
          "messages massivi kerak: [{role,content}, ...], oxirgisi assistant bo'lishi shart",
      },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(dialogs)
    .values({
      conversationId:
        typeof b.conversationId === "string" && b.conversationId
          ? b.conversationId
          : "manual",
      provider:
        typeof b.provider === "string" && b.provider ? b.provider : "human",
      verified: b.verified === true,
      messages,
    })
    .returning();

  return Response.json({ ok: true, id: row?.id ?? null });
}

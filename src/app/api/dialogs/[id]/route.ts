import { db } from "@/db";
import { dialogs } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import type { DialogMessage } from "@/lib/dialogs";
import { parseDialogMessages } from "@/lib/dialogs";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Kuratorial tahrir + tasdiqlash (2-bosqich: "verified = true").
//   PATCH {"verified": true}                 — o'qitishga tayyor deb belgilash
//   PATCH {"messages": [...]}                — chala javobni to'g'rilash
//   PATCH {"verified": true, "messages":[]}  — tahrirlash + tasdiqlash
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const dialogId = Number(id);
  if (!Number.isInteger(dialogId) || dialogId <= 0) {
    return Response.json({ error: "noto'g'ri id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "noto'g'ri JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as { verified?: unknown; messages?: unknown };

  const patch: {
    verified?: boolean;
    messages?: DialogMessage[];
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (b.verified !== undefined) {
    if (typeof b.verified !== "boolean") {
      return Response.json({ error: "verified faqat boolean" }, { status: 400 });
    }
    patch.verified = b.verified;
  }
  if (b.messages !== undefined) {
    const parsed = parseDialogMessages(b.messages);
    if (!parsed) {
      return Response.json(
        {
          error:
            "messages noto'g'ri: [{role,content}, ...], oxirgisi assistant bo'lishi kerak",
        },
        { status: 400 },
      );
    }
    patch.messages = parsed;
  }
  if (patch.verified === undefined && patch.messages === undefined) {
    return Response.json(
      { error: "verified yoki messages yuboring" },
      { status: 400 },
    );
  }

  const [row] = await db
    .update(dialogs)
    .set(patch)
    .where(eq(dialogs.id, dialogId))
    .returning();
  if (!row) {
    return Response.json({ error: "topilmadi" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    dialog: {
      id: row.id,
      verified: row.verified,
      provider: row.provider,
      messages: row.messages,
      updatedAt: row.updatedAt,
    },
  });
}

import { db } from "@/db";
import { dialogs } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import { dialogsToJsonl } from "@/lib/dialogs";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Fine-tuning uchun JSONL export.
// Default: FAQAT tasdiqlangan namunalar (verified=true) — ular o'qitishga
// ketadi. ?verified=all | ?verified=false bilan boshqacha olish mumkin.
export async function GET(req: Request) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const mode = new URL(req.url).searchParams.get("verified") ?? "true";
  const where =
    mode === "all"
      ? undefined
      : eq(dialogs.verified, mode !== "false");

  const rows = await db
    .select({ messages: dialogs.messages })
    .from(dialogs)
    .where(where)
    .orderBy(asc(dialogs.id));

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(dialogsToJsonl(rows), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="dialogs-${stamp}.jsonl"`,
      "Cache-Control": "no-store",
    },
  });
}

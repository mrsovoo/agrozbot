import { db } from "@/db";
import { groups } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const gid = Number(id);
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    category?: string;
    active?: boolean;
    cleanJoinLeave?: boolean;
  };
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.category === "string") patch.category = body.category;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.cleanJoinLeave === "boolean")
    patch.cleanJoinLeave = body.cleanJoinLeave;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }
  const [updated] = await db
    .update(groups)
    .set(patch)
    .where(eq(groups.id, gid))
    .returning();
  if (!updated) {
    return Response.json({ error: "Topilmadi" }, { status: 404 });
  }
  return Response.json({ group: { ...updated, chatId: String(updated.chatId) } });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.delete(groups).where(eq(groups.id, Number(id)));
  return Response.json({ ok: true });
}

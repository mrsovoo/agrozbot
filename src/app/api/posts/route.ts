import { db } from "@/db";
import { posts, postTargets, groups } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import { desc, inArray } from "drizzle-orm";
import { distributePost } from "@/lib/sender";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(50);
  const ids = rows.map((r) => r.id);
  const targets = ids.length
    ? await db.select().from(postTargets).where(inArray(postTargets.postId, ids))
    : [];
  const groupRows = await db.select().from(groups);
  const groupMap = new Map(groupRows.map((g) => [g.id, g.title]));

  const result = rows.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    hasImage: !!p.imageData || !!p.imageFileId,
    status: p.status,
    source: p.source,
    createdAt: p.createdAt,
    targets: targets
      .filter((t) => t.postId === p.id)
      .map((t) => ({
        id: t.id,
        group: groupMap.get(t.groupId) || "?",
        status: t.status,
        error: t.error,
      })),
  }));
  return Response.json({ posts: result });
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const body = String(form.get("body") || "").trim();
  const targetsRaw = String(form.get("targets") || "[]");

  let targets: { groupId: number; threadId?: number | null }[] = [];
  try {
    const parsed = JSON.parse(targetsRaw);
    if (Array.isArray(parsed)) {
      targets = parsed
        .map((t) => ({
          groupId: Number(t.groupId),
          threadId:
            t.threadId !== undefined && t.threadId !== null && t.threadId !== ""
              ? Number(t.threadId)
              : null,
        }))
        .filter((t) => Number.isFinite(t.groupId));
    }
  } catch {
    // ignore
  }

  if (!title && !body && !(form.get("image") instanceof File)) {
    return Response.json(
      { error: "Matn yoki rasm kiriting" },
      { status: 400 },
    );
  }
  if (targets.length === 0) {
    return Response.json(
      { error: "Kamida bitta guruh tanlang" },
      { status: 400 },
    );
  }

  let imageData: string | null = null;
  let imageMime: string | null = null;
  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 4 * 1024 * 1024) {
      return Response.json(
        { error: "Rasm hajmi 4MB dan oshmasligi kerak" },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await image.arrayBuffer());
    imageData = buf.toString("base64");
    imageMime = image.type || "image/jpeg";
  }

  const [post] = await db
    .insert(posts)
    .values({
      title,
      body,
      imageData,
      imageMime,
      status: "sending",
      source: "web",
    })
    .returning();

  const result = await distributePost(post.id, targets);

  return Response.json({
    ok: true,
    postId: post.id,
    sent: result.sent,
    failed: result.failed,
  });
}

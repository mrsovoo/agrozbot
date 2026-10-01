import { db } from "@/db";
import { posts } from "@/db/schema";
import { isAuthed } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { tgGetFileBuffer } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return new Response("unauthorized", { status: 401 });
  }
  const { id } = await params;
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, Number(id)));
  if (!post) return new Response("not found", { status: 404 });

  if (post.imageData) {
    const buf = Buffer.from(post.imageData, "base64");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": post.imageMime || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  if (post.imageFileId) {
    const file = await tgGetFileBuffer(post.imageFileId);
    if (file) {
      return new Response(new Uint8Array(file.buffer), {
        headers: { "Content-Type": file.mime },
      });
    }
  }
  return new Response("no image", { status: 404 });
}

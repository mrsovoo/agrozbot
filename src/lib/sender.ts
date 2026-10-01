import { db } from "@/db";
import { groups, posts, postTargets } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  formatPost,
  tgSendMessage,
  tgSendPhotoBuffer,
  tgSendPhotoFileId,
} from "./telegram";

const CAPTION_LIMIT = 1024;

type SendTarget = { groupId: number; threadId?: number | null };

/**
 * Berilgan postni tanlangan guruhlarga tartibli yuboradi.
 * post allaqachon DB da yaratilgan bo'lishi kerak.
 */
export async function distributePost(
  postId: number,
  targets: SendTarget[],
): Promise<{ sent: number; failed: number }> {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new Error("Post topilmadi");

  await db
    .update(posts)
    .set({ status: "sending" })
    .where(eq(posts.id, postId));

  const groupIds = targets.map((t) => t.groupId);
  const groupRows = groupIds.length
    ? await db.select().from(groups).where(inArray(groups.id, groupIds))
    : [];
  const groupMap = new Map(groupRows.map((g) => [g.id, g]));

  let sent = 0;
  let failed = 0;

  for (const target of targets) {
    const group = groupMap.get(target.groupId);
    if (!group) {
      failed++;
      continue;
    }

    const caption = formatPost({
      title: post.title,
      body: post.body,
      category: group.category,
    });

    let messageId: number | null = null;
    let errorText: string | null = null;

    try {
      const hasImage = !!post.imageData || !!post.imageFileId;

      if (hasImage) {
        const captionFits = caption.length <= CAPTION_LIMIT;
        const photoCaption = captionFits ? caption : undefined;

        let photoRes;
        if (post.imageFileId) {
          photoRes = await tgSendPhotoFileId({
            chatId: group.chatId,
            fileId: post.imageFileId,
            caption: photoCaption,
            threadId: target.threadId,
          });
        } else {
          const buffer = Buffer.from(post.imageData as string, "base64");
          photoRes = await tgSendPhotoBuffer({
            chatId: group.chatId,
            buffer,
            mime: post.imageMime || "image/jpeg",
            caption: photoCaption,
            threadId: target.threadId,
          });
        }

        if (!photoRes.ok) {
          errorText = photoRes.description || "Rasm yuborilmadi";
        } else {
          messageId = photoRes.result?.message_id ?? null;
          // caption sig'masa, matnni alohida yuboramiz
          if (!captionFits && caption) {
            await tgSendMessage({
              chatId: group.chatId,
              text: caption,
              threadId: target.threadId,
            });
          }
        }
      } else {
        const res = await tgSendMessage({
          chatId: group.chatId,
          text: caption || "(bo'sh xabar)",
          threadId: target.threadId,
        });
        if (!res.ok) errorText = res.description || "Xabar yuborilmadi";
        else messageId = res.result?.message_id ?? null;
      }
    } catch (err) {
      errorText = err instanceof Error ? err.message : "Noma'lum xatolik";
    }

    if (errorText) {
      failed++;
      await db.insert(postTargets).values({
        postId,
        groupId: group.id,
        threadId: target.threadId ?? null,
        status: "failed",
        error: errorText,
      });
    } else {
      sent++;
      await db.insert(postTargets).values({
        postId,
        groupId: group.id,
        threadId: target.threadId ?? null,
        messageId,
        status: "sent",
        sentAt: new Date(),
      });
    }
  }

  const finalStatus =
    failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
  await db
    .update(posts)
    .set({ status: finalStatus })
    .where(eq(posts.id, postId));

  return { sent, failed };
}

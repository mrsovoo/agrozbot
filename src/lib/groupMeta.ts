import { db } from "@/db";
import { groups } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  tgGetBotId,
  tgGetChatMember,
  tgGetChatMemberCount,
  type TgChatMember,
} from "./telegram";

// Guruh haqidagi Telegram'dagi haqiqiy holat
export type GroupMeta = {
  chatId: number;
  // A'zolar soni — olinmagan bo'lsa null (bot guruhda emas / xatolik)
  memberCount: number | null;
  // Botning guruhdagi statusi: creator|administrator|member|left|kicked|null
  botStatus: string | null;
  botIsAdmin: boolean;
  // Xabar o'chirish huquqi (kirdi/chiqdi tozalash uchun shart)
  botCanDelete: boolean;
};

/**
 * A'zolar soni + botning admin holatini Telegram'dan o'qiydi.
 * Hech narsa yozmaydi — faqat o'qiydi (syncGroup yozadi).
 */
export async function fetchGroupMeta(chatId: number): Promise<GroupMeta> {
  const [memberCount, botMember] = await Promise.all([
    tgGetChatMemberCount(chatId),
    (async (): Promise<TgChatMember | null> => {
      const botId = await tgGetBotId();
      if (!botId) return null;
      return tgGetChatMember(chatId, botId);
    })(),
  ]);

  const status = botMember?.status ?? null;
  const botIsAdmin = status === "administrator" || status === "creator";
  return {
    chatId,
    memberCount,
    botStatus: status,
    botIsAdmin,
    // creator'da can_delete_messages maydoni kelmaydi (u hamma huquqqa ega)
    botCanDelete: status === "creator" || botMember?.can_delete_messages === true,
  };
}

/**
 * Guruh yozuvini Telegram'dagi haqiqiy holat bilan yangilaydi.
 * Faqat muvaffaqiyatli olingan maydonlar yoziladi — xato bo'lsa eski qiymat
 * saqlanib qoladi (a'zolar soni 0 ga tushib qolmaydi).
 */
export async function syncGroup(group: {
  id: number;
  chatId: number;
}): Promise<GroupMeta> {
  const meta = await fetchGroupMeta(group.chatId);
  const patch: Partial<typeof groups.$inferInsert> = {};

  if (meta.memberCount !== null) patch.memberCount = meta.memberCount;
  if (meta.botStatus !== null) {
    patch.botIsAdmin = meta.botIsAdmin;
    patch.botCanDelete = meta.botCanDelete;
  }
  if (Object.keys(patch).length === 0) return meta; // hech narsa aniqlanmadi

  patch.memberCountUpdatedAt = new Date();
  await db.update(groups).set(patch).where(eq(groups.id, group.id));
  return meta;
}

export type SyncSummary = {
  total: number;
  members: number;
  adminOk: number;
  failed: number;
};

// Kichik parallellik: Telegram rate-limitiga (≈30 req/s) tegmasligi uchun
const SYNC_CONCURRENCY = 4;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/**
 * Guruhlarni Telegram bilan sinxronlaydi.
 * onlyIds berilmasa — barcha FAOL guruhlar.
 */
export async function syncAllGroups(onlyIds?: number[]): Promise<SyncSummary> {
  const rows =
    onlyIds && onlyIds.length > 0
      ? await db.select().from(groups).where(inArray(groups.id, onlyIds))
      : await db.select().from(groups).where(eq(groups.active, true));

  const metas = await mapLimit(rows, SYNC_CONCURRENCY, async (g) => {
    try {
      return await syncGroup({ id: g.id, chatId: g.chatId });
    } catch {
      return null;
    }
  });

  let members = 0;
  let adminOk = 0;
  let failed = 0;

  for (const meta of metas) {
    if (!meta) {
      failed++;
      continue;
    }
    // Hech bir maydon olinmasa — bot guruhda emas yoki API xato berdi
    if (meta.botStatus === null && meta.memberCount === null) failed++;
    if (meta.memberCount !== null) members += meta.memberCount;
    if (meta.botIsAdmin) adminOk++;
  }

  return { total: rows.length, members, adminOk, failed };
}
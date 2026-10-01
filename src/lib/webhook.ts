import { db } from "@/db";
import { groups, topics, botDrafts, cleanLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  tgCall,
  tgDeleteMessage,
  tgSendMessage,
  categoryLabel,
} from "./telegram";
import { isBotAdmin, ensureAdminRecorded } from "./botAdmin";
import { syncAllGroups, syncGroup } from "./groupMeta";
import { activeGroups } from "./queries";
import { startAgent, handleAgentText, handleAgentCallback } from "./agent/flow";
import type {
  TgUser,
  TgChat,
  TgMessage,
  TgCallback,
  TgChatMemberUpdated,
  TgUpdate,
} from "./tgTypes";

// Telegram tiplari ./tgTypes.ts da (agent flow bilan umumiy)

function detectCategory(title: string): string {
  const t = (title || "").toLowerCase();
  if (/(ferma|chorva|mol|qoramol|parranda|tovuq|baliq)/.test(t)) return "ferma";
  if (/(agro|dehqon|dehqonchilik|ekin|bog|sabzavot|meva|urug)/.test(t))
    return "agro";
  return "boshqa";
}

async function upsertGroup(chat: TgChat) {
  const existing = await db
    .select()
    .from(groups)
    .where(eq(groups.chatId, chat.id));
  if (existing.length > 0) {
    await db
      .update(groups)
      .set({
        title: chat.title ?? existing[0].title,
        username: chat.username ?? null,
        isForum: chat.is_forum ?? existing[0].isForum,
        active: true,
      })
      .where(eq(groups.chatId, chat.id));
    return existing[0];
  }
  const [created] = await db
    .insert(groups)
    .values({
      chatId: chat.id,
      title: chat.title ?? "Guruh",
      username: chat.username ?? null,
      isForum: chat.is_forum ?? false,
      category: detectCategory(chat.title ?? ""),
      active: true,
    })
    .returning();
  return created;
}

async function handleGroupMessage(msg: TgMessage) {
  const group = await upsertGroup(msg.chat);

  // Forum mavzusini ro'yxatga olish
  if (msg.forum_topic_created && msg.message_thread_id) {
    await db
      .insert(topics)
      .values({
        groupId: group.id,
        threadId: msg.message_thread_id,
        name: msg.forum_topic_created.name,
      })
      .onConflictDoNothing();
  }

  // Kirdi/chiqdi (service) xabarlarni tozalash
  const isJoin = Array.isArray(msg.new_chat_members) && msg.new_chat_members.length > 0;
  const isLeave = !!msg.left_chat_member;
  if ((isJoin || isLeave) && group.cleanJoinLeave) {
    const del = await tgDeleteMessage(msg.chat.id, msg.message_id);
    if (del.ok) {
      await db
        .insert(cleanLog)
        .values({ groupId: group.id, kind: isJoin ? "join" : "leave" });
    } else {
      // Ko'pincha: bot admin emas yoki "delete messages" huquqi yo'q.
      // Statistikani buzmaslik uchun clean_log faqat muvaffaqiyatda yoziladi.
      console.error(
        "deleteMessage failed",
        group.chatId,
        del.description ?? "unknown error",
      );
    }
  }

  // A'zolar soni faqat shunday hodisalarda o'zgaradi — har bir xabarda
  // Telegram API ni chaqirmaslik uchun sinxronlashni shu yerga qo'yamiz.
  if (isJoin || isLeave || msg.group_chat_created || msg.supergroup_chat_created) {
    await syncGroup({ id: group.id, chatId: group.chatId });
  }
}

async function handlePrivateMessage(msg: TgMessage) {
  const user = msg.from;
  if (!user) return;

  const admin = await isBotAdmin(user.id);
  const text = msg.text || "";

  // Komandalar
  if (text.startsWith("/start")) {
    await ensureAdminRecorded(user);
    const nowAdmin = await isBotAdmin(user.id);
    await tgSendMessage({
      chatId: msg.chat.id,
      text:
        `👋 Assalomu alaykum!\n\n` +
        `Men <b>Agro & Ferma</b> post tarqatuvchi botman.\n\n` +
        (nowAdmin
          ? `✅ Siz adminsiz. Menga <b>matn</b> yoki <b>rasm + izoh</b> yuboring — men uni kerakli guruhlarga tartibli tarqataman.\n\n` +
            `Buyruqlar:\n/panel — guruhlar va a'zolar soni\n/sync — a'zolar sonini yangilash\n/id — chat ID\n/help — yordam`
          : `⛔️ Siz admin emassiz. Admin bilan bog'laning.`),
    });
    return;
  }

  if (text.startsWith("/id")) {
    await tgSendMessage({
      chatId: msg.chat.id,
      text: `🆔 Sizning ID: <code>${user.id}</code>\nChat ID: <code>${msg.chat.id}</code>`,
    });
    return;
  }

  if (text.startsWith("/help")) {
    await tgSendMessage({
      chatId: msg.chat.id,
      text:
        `ℹ️ <b>Yordam</b>\n\n` +
        `• Menga matn yoki rasm yuboring\n` +
        `• Guruhlarni belgilang\n` +
        `• "Yuborish" tugmasini bosing\n` +
        `• /panel — guruhlar va a'zolar soni\n` +
        `• /sync — a'zolar sonini yangilash\n\n` +
        `Guruhga meni <b>admin</b> qilib qo'shing (xabar o'chirish huquqi bilan), ` +
        `shunda kirdi/chiqdi xabarlarini avtomatik tozalayman.`,
    });
    return;
  }

  if (!admin) {
    await tgSendMessage({
      chatId: msg.chat.id,
      text: "⛔️ Kechirasiz, bu bot faqat adminlar uchun.",
    });
    return;
  }

  if (text.startsWith("/cancel")) {
    await db.delete(botDrafts).where(eq(botDrafts.telegramUserId, user.id));
    await tgSendMessage({
      chatId: msg.chat.id,
      text: "❌ Bekor qilindi. Yangi post uchun poster yoki matn yuboring.",
    });
    return;
  }

  if (text.startsWith("/panel") || text.startsWith("/groups")) {
    const gl = await activeGroups();
    if (gl.length === 0) {
      await tgSendMessage({
        chatId: msg.chat.id,
        text: "📭 Hali guruhlar yo'q. Meni guruhga admin qilib qo'shing.",
      });
      return;
    }
    const totalMembers = gl.reduce((s, g) => s + (g.memberCount ?? 0), 0);
    const list = gl
      .map((g, i) => {
        const members = g.memberCount != null ? ` — 👥 ${g.memberCount}` : "";
        const warn = g.botIsAdmin ? "" : " ⚠️";
        return `${i + 1}. ${categoryLabel(g.category)} — <b>${g.title}</b>${members}${warn}`;
      })
      .join("\n");
    await tgSendMessage({
      chatId: msg.chat.id,
      text:
        `📋 <b>Guruhlar (${gl.length})</b> — jami 👥 <b>${totalMembers}</b> a'zo\n\n${list}\n\n` +
        `⚠️ — bot o'sha guruhda admin emas (kirdi/chiqdi tozalanmaydi).\n` +
        `A'zolar sonini yangilash: /sync`,
    });
    return;
  }

  if (text.startsWith("/sync")) {
    await tgSendMessage({
      chatId: msg.chat.id,
      text: "⏳ Guruhlar Telegram bilan sinxronlanmoqda...",
    });
    const sum = await syncAllGroups();
    const list = (await activeGroups())
      .map((g, i) => {
        const members = g.memberCount != null ? `👥 ${g.memberCount}` : "👥 ?";
        return `${i + 1}. <b>${g.title}</b> — ${members}${g.botIsAdmin ? "" : " ⚠️"}`;
      })
      .join("\n");
    await tgSendMessage({
      chatId: msg.chat.id,
      text:
        `🔄 <b>Yangilandi</b>\n\n` +
        `Guruhlar: <b>${sum.total}</b>\n` +
        `Jami a'zolar: <b>${sum.members}</b>\n` +
        `Bot admin: <b>${sum.adminOk}/${sum.total}</b>\n` +
        (sum.failed ? `O'qib bo'lmadi: <b>${sum.failed}</b>\n` : "") +
        (list ? `\n${list}` : ""),
    });
    return;
  }

  // Kontent (matn yoki rasm) -> agent suhbatini boshlaymiz
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  if (hasPhoto || text) {
    // Rasm = yangi post (caption mavzu bo'ladi)
    if (hasPhoto) {
      const photos = msg.photo!;
      const best = photos[photos.length - 1];
      await startAgent({
        chatId: msg.chat.id,
        userId: user.id,
        brief: msg.caption ?? null,
        type: "photo",
        fileId: best.file_id,
      });
      return;
    }

    // Suhbat davomida kelayotgan matn (mavzu / havola / qo'shimcha / tahrir)?
    const handled = await handleAgentText(msg.chat.id, user.id, text);
    if (handled) return;

    if (text.startsWith("/")) {
      await tgSendMessage({
        chatId: msg.chat.id,
        text: "🤔 Noma'lum buyruq. /help — ro'yxat.",
      });
      return;
    }

    // Yangi post: matn = qisqa mavzu (brief)
    await startAgent({
      chatId: msg.chat.id,
      userId: user.id,
      brief: text,
      type: "text",
      fileId: null,
    });
  }
}

async function handleCallback(cb: TgCallback) {
  const user = cb.from;
  const data = cb.data || "";
  const admin = await isBotAdmin(user.id);
  if (!admin) {
    await tgCall("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: "⛔️ Ruxsat yo'q",
      show_alert: true,
    });
    return;
  }

  // Eski format kalitlarini agent formatiga keltiramiz
  // (g:12 → a:g:12, all → a:all, send → a:send, cancel → a:cancel).
  let normalized = data;
  if (data.startsWith("g:")) normalized = `a:g:${data.slice(2)}`;
  else if (data === "all") normalized = "a:all";
  else if (data === "none") normalized = "a:none";
  else if (data === "send") normalized = "a:send";
  else if (data === "cancel") normalized = "a:cancel";

  await handleAgentCallback(cb, normalized);
}

async function handleMyChatMember(upd: TgChatMemberUpdated) {
  const chat = upd.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") return;
  const status = upd.new_chat_member.status;
  if (status === "member" || status === "administrator") {
    const group = await upsertGroup(chat);
    // Bot qo'shildi yoki admin qilindi → a'zolar soni va huquqlarni yangilaymiz
    await syncGroup({ id: group.id, chatId: chat.id });
  } else if (status === "left" || status === "kicked") {
    await db
      .update(groups)
      .set({ active: false })
      .where(eq(groups.chatId, chat.id));
  }
}

export async function processUpdate(update: TgUpdate) {
  try {
    if (update.my_chat_member) {
      await handleMyChatMember(update.my_chat_member);
      return;
    }
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return;
    }
    const msg = update.message || update.edited_message;
    if (!msg) return;

    const chatType = msg.chat.type;
    if (chatType === "private") {
      await handlePrivateMessage(msg);
    } else if (chatType === "group" || chatType === "supergroup") {
      await handleGroupMessage(msg);
    }
  } catch (err) {
    console.error("processUpdate error", err);
  }
}



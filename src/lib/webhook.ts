import { db } from "@/db";
import { groups, topics, botDrafts, posts, cleanLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  tgCall,
  tgDeleteMessage,
  tgSendMessage,
  categoryLabel,
} from "./telegram";
import { isBotAdmin, ensureAdminRecorded } from "./botAdmin";
import { distributePost } from "./sender";
import { syncAllGroups, syncGroup } from "./groupMeta";

type TgUser = {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
};
type TgChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
  is_forum?: boolean;
};
type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  caption?: string;
  message_thread_id?: number;
  photo?: { file_id: string; file_unique_id: string; width: number }[];
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
  forum_topic_created?: { name: string };
  new_chat_title?: string;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
};
type TgCallback = {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
};
type TgChatMemberUpdated = {
  chat: TgChat;
  from: TgUser;
  new_chat_member: { user: TgUser; status: string };
};
type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: TgCallback;
  my_chat_member?: TgChatMemberUpdated;
};

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

function buildDraftKeyboard(
  groupList: { id: number; title: string; category: string }[],
  selected: number[],
) {
  const rows: { text: string; callback_data: string }[][] = [];
  for (const g of groupList) {
    const checked = selected.includes(g.id);
    rows.push([
      {
        text: `${checked ? "✅" : "⬜️"} ${g.title}`,
        callback_data: `g:${g.id}`,
      },
    ]);
  }
  rows.push([
    { text: "☑️ Barchasi", callback_data: "all" },
    { text: "◻️ Tozalash", callback_data: "none" },
  ]);
  rows.push([
    { text: "📤 Yuborish", callback_data: "send" },
    { text: "❌ Bekor", callback_data: "cancel" },
  ]);
  return { inline_keyboard: rows };
}

async function activeGroups() {
  return db.select().from(groups).where(eq(groups.active, true));
}

async function showDraftPanel(userId: number, chatId: number) {
  const [draft] = await db
    .select()
    .from(botDrafts)
    .where(eq(botDrafts.telegramUserId, userId));
  if (!draft) return;
  const gl = await activeGroups();
  const selected = (draft.selectedGroupIds as number[]) || [];
  const kb = buildDraftKeyboard(
    gl.map((g) => ({ id: g.id, title: g.title, category: g.category })),
    selected,
  );
  const previewType = draft.type === "photo" ? "🖼 Rasm + matn" : "✍️ Matn";
  const text =
    `📝 <b>Yangi post tayyor</b>\n\n` +
    `Turi: ${previewType}\n` +
    `Tanlangan guruhlar: <b>${selected.length}</b> ta\n\n` +
    `Quyidan guruhlarni belgilang va <b>Yuborish</b> tugmasini bosing.`;

  const res = await tgSendMessage({
    chatId,
    text,
    replyMarkup: kb,
  });
  if (res.ok && res.result) {
    await db
      .update(botDrafts)
      .set({ controlMessageId: res.result.message_id })
      .where(eq(botDrafts.telegramUserId, userId));
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

  // Kontent (matn yoki rasm) -> draft yaratamiz
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  if (hasPhoto || text) {
    let type: "text" | "photo" = "text";
    let fileId: string | null = null;
    let draftText: string | null = null;

    if (hasPhoto) {
      type = "photo";
      const best = msg.photo![msg.photo!.length - 1];
      fileId = best.file_id;
      draftText = msg.caption ?? null;
    } else {
      draftText = text;
    }

    await db
      .insert(botDrafts)
      .values({
        telegramUserId: user.id,
        type,
        text: draftText,
        fileId,
        selectedGroupIds: [],
      })
      .onConflictDoUpdate({
        target: botDrafts.telegramUserId,
        set: {
          type,
          text: draftText,
          fileId,
          selectedGroupIds: [],
          controlMessageId: null,
          updatedAt: new Date(),
        },
      });

    await showDraftPanel(user.id, msg.chat.id);
    return;
  }
}

async function handleCallback(cb: TgCallback) {
  const user = cb.from;
  const data = cb.data || "";
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  if (!chatId || !messageId) return;

  const admin = await isBotAdmin(user.id);
  if (!admin) {
    await tgCall("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: "⛔️ Ruxsat yo'q",
      show_alert: true,
    });
    return;
  }

  const [draft] = await db
    .select()
    .from(botDrafts)
    .where(eq(botDrafts.telegramUserId, user.id));
  if (!draft) {
    await tgCall("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: "Draft topilmadi, qaytadan yuboring.",
    });
    return;
  }

  let selected = (draft.selectedGroupIds as number[]) || [];
  const gl = await activeGroups();

  if (data.startsWith("g:")) {
    const gid = Number(data.slice(2));
    if (selected.includes(gid)) selected = selected.filter((x) => x !== gid);
    else selected = [...selected, gid];
  } else if (data === "all") {
    selected = gl.map((g) => g.id);
  } else if (data === "none") {
    selected = [];
  } else if (data === "cancel") {
    await db
      .delete(botDrafts)
      .where(eq(botDrafts.telegramUserId, user.id));
    await tgCall("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "❌ Bekor qilindi.",
    });
    await tgCall("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  } else if (data === "send") {
    if (selected.length === 0) {
      await tgCall("answerCallbackQuery", {
        callback_query_id: cb.id,
        text: "Avval kamida bitta guruh tanlang!",
        show_alert: true,
      });
      return;
    }
    // Post yaratamiz
    const [post] = await db
      .insert(posts)
      .values({
        title: "",
        body: draft.text || "",
        imageFileId: draft.type === "photo" ? draft.fileId : null,
        status: "sending",
        source: "bot",
      })
      .returning();

    await tgCall("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "⏳ Yuborilmoqda...",
    });
    await tgCall("answerCallbackQuery", { callback_query_id: cb.id });

    const result = await distributePost(
      post.id,
      selected.map((groupId) => ({ groupId })),
    );

    await db.delete(botDrafts).where(eq(botDrafts.telegramUserId, user.id));
    await tgCall("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text:
        `✅ Yuborildi!\n\n` +
        `Muvaffaqiyatli: <b>${result.sent}</b>\n` +
        (result.failed ? `Xato: <b>${result.failed}</b>` : ""),
      parse_mode: "HTML",
    });
    return;
  }

  // selection yangilash
  await db
    .update(botDrafts)
    .set({ selectedGroupIds: selected, updatedAt: new Date() })
    .where(eq(botDrafts.telegramUserId, user.id));

  const kb = buildDraftKeyboard(
    gl.map((g) => ({ id: g.id, title: g.title, category: g.category })),
    selected,
  );
  await tgCall("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: kb,
  });
  await tgCall("answerCallbackQuery", {
    callback_query_id: cb.id,
    text: `Tanlangan: ${selected.length} ta`,
  });
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



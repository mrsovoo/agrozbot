// Bot "agent" suhbati: poster/matn qabul qilish → savollar → copywriting →
// preview → kerakli guruhlarga tarqatish.
//
// Holat `bot_drafts.session` (jsonb) da saqlanadi, shu sababli jarayon
// xabarlar orasida uzilib qolmaydi (webhook har safar yangi so'rov).

import { db } from "@/db";
import { botDrafts, posts, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  categoryHashtag,
  escapeHtml,
  formatPost,
  tgCall,
  tgSendMessage,
  tgSendPhotoFileId,
} from "../telegram";
import { distributePost } from "../sender";
import { activeGroups } from "../queries";
import { recordDialog } from "../dialogs";
import type { TgCallback } from "../tgTypes";
import {
  buildUserPrompt,
  splitTitleBody,
  SYSTEM_PROMPT,
  writePost,
  type WriteInput,
} from "./writer";
import {
  categoryLabelUz,
  detectCategoryFromText,
  lengthLabelUz,
  legacySession,
  looksLikeLink,
  normalizeLink,
  newSession,
  type AgentCategory,
  type AgentSession,
} from "./types";

const CAPTION_LIMIT = 1000;

type Draft = typeof botDrafts.$inferSelect;
type GroupRow = {
  id: number;
  title: string;
  category: string;
  memberCount: number | null;
};
type InlineKeyboard = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

function askRow(text: string, data: string) {
  return [{ text, callback_data: data }];
}
function navRow(): { text: string; callback_data: string }[] {
  return [
    { text: "✅ Shu bilan yozdirish", callback_data: "a:done" },
    { text: "🗑 Bekor qilish", callback_data: "a:cancel" },
  ];
}

// ─── Draft / session yordamchilari ───────────────────────────────────────

async function loadDraft(userId: number): Promise<Draft | null> {
  const rows = await db
    .select()
    .from(botDrafts)
    .where(eq(botDrafts.telegramUserId, userId));
  return rows[0] ?? null;
}

// Eski (agentdan oldingi) draftlarda session bo'lmaydi — qabul qilib olamiz
function sessionOf(draft: Draft): AgentSession {
  return draft.session ?? legacySession(draft.text);
}

async function saveSession(
  userId: number,
  session: AgentSession,
  patch: Partial<typeof botDrafts.$inferInsert> = {},
) {
  await db
    .update(botDrafts)
    .set({ session, updatedAt: new Date(), ...patch })
    .where(eq(botDrafts.telegramUserId, userId));
}

// Kategoriyaga mos guruhlarni avtomatik tanlaymiz (topilmasa — barchasi)
function pickGroups(all: GroupRow[], category: AgentCategory): number[] {
  if (category === "boshqa") return all.map((g) => g.id);
  const matching = all.filter((g) => g.category === category);
  return (matching.length > 0 ? matching : all).map((g) => g.id);
}

function resolveCategory(session: AgentSession): AgentCategory {
  if (session.answers.category) return session.answers.category;
  return detectCategoryFromText(session.brief) ?? "boshqa";
}

// WriteInput yig'uvchi — generatsiya VA dialog yozishda BIR XIL ma'lumot
// ishlatilsin (o'qitish namunasi real inference'ga mos bo'lsin)
function toWriteInput(
  session: AgentSession,
  category: AgentCategory,
  gl: GroupRow[],
): WriteInput {
  const selected = pickGroups(gl, category);
  return {
    brief: session.brief,
    category,
    length: session.answers.length,
    link: session.answers.link,
    extra: session.answers.extra,
    groupTitles: gl.filter((g) => selected.includes(g.id)).map((g) => g.title),
    variant: session.tries,
  };
}

// (system, user, assistant) namunasini fine-tuning bazasiga yozamiz.
// recordDialog o'zi xatoni yutadi — bu yerda xato bo'lsa ham flow davom etadi.
async function recordDialogFor(
  draftId: number,
  userId: number,
  input: WriteInput,
  result: { text: string; provider: string },
) {
  const text = (result.text || "").trim();
  if (!text) return;
  await recordDialog({
    conversationId: `draft:${draftId}`,
    telegramUserId: userId,
    provider: result.provider,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
      { role: "assistant", content: text },
    ],
  });
}

function groupSummary(all: GroupRow[], selected: number[]): string {
  const names = all
    .filter((g) => selected.includes(g.id))
    .map((g) => escapeHtml(g.title));
  if (names.length === 0) return "tanlanmagan";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}

async function asGroups(): Promise<GroupRow[]> {
  const rows = await activeGroups();
  return rows.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    memberCount: g.memberCount,
  }));
}

// ─── Savollar ────────────────────────────────────────────────────────────

function questionText(step: number): string {
  switch (step) {
    case 0:
      return (
        `1/4 · 🎯 <b>Post qaysi yo'nalish uchun?</b>\n\n` +
        `Yo'nalish guruh tanlashga va hashtag'ga ta'sir qiladi.`
      );
    case 1:
      return (
        `2/4 · ✍️ <b>Matn qanday bo'lsin?</b>\n\n` +
        `Qisqa e'lonmi yoki batafsil tushuntirish?`
      );
    case 2:
      return (
        `3/4 · 🔗 <b>Havola (link) qo'shilsinmi?</b>\n\n` +
        `Kanal, sayt yoki aloqa uchun havola bo'lsa — qo'shib qo'yaman.`
      );
    default:
      return (
        `4/4 · 🧾 <b>Qo'shimcha ma'lumot bormi?</b>\n\n` +
        `Narx, miqdor, sana, telefon yoki manzil bo'lsa yozing — o'ylab topmayman, ` +
        `faqat siz bergan ma'lumotni ishlataman.`
      );
  }
}

function questionKeyboard(step: number): InlineKeyboard {
  switch (step) {
    case 0:
      return {
        inline_keyboard: [
          askRow("🌾 Agro dehqonchilik", "a:cat:agro"),
          askRow("🐄 Ferma va chorvachilik", "a:cat:ferma"),
          askRow("📋 Boshqa / umumiy", "a:cat:boshqa"),
          askRow("🤖 O'zing aniqlagin", "a:cat:auto"),
          navRow(),
        ],
      };
    case 1:
      return {
        inline_keyboard: [
          askRow("⚡ Qisqa (3-5 satr)", "a:len:short"),
          askRow("⚖️ O'rtacha (tavsiya)", "a:len:medium"),
          askRow("📚 Batafsil", "a:len:long"),
          askRow("🤖 O'zing tanla", "a:len:auto"),
          navRow(),
        ],
      };
    case 2:
      return {
        inline_keyboard: [
          askRow("🔗 Ha, havola qo'shiladi", "a:link:yes"),
          askRow("🚫 Yo'q, havolasiz", "a:link:no"),
          navRow(),
        ],
      };
    default:
      return {
        inline_keyboard: [
          askRow("✍️ Ha, yozaman", "a:extra:yes"),
          askRow("🤷 Yo'q, o'zing yoz", "a:extra:no"),
          navRow(),
        ],
      };
  }
}

async function askStep(chatId: number, session: AgentSession) {
  const step = Math.min(Math.max(session.step, 0), 3);
  await tgSendMessage({
    chatId,
    text: questionText(step),
    replyMarkup: questionKeyboard(step),
  });
}

async function askBrief(chatId: number) {
  await tgSendMessage({
    chatId,
    text:
      `📝 <b>Bu post nima haqida?</b>\n\n` +
      `Bir-ikki gap bilan mavzuni yozing (masalan: «sigir uchun ozuqa, yangi partiya» ` +
      `yoki «issiqxonada pomidor ko'chati sotiladi»).\n\n` +
      `Shundan keyin bir necha qisqa savol beraman va matnni o'zim yozaman.`,
  });
}

async function askLink(chatId: number) {
  await tgSendMessage({
    chatId,
    text:
      `🔗 <b>Havolani yuboring</b>\n\n` +
      `Masalan: <code>https://t.me/kanal</code>, <code>t.me/kanal</code> ` +
      `yoki <code>@kanal</code>`,
    replyMarkup: {
      inline_keyboard: [
        askRow("⏭ Havolasiz davom etish", "a:link:no"),
        askRow("🗑 Bekor qilish", "a:cancel"),
      ],
    },
  });
}

async function askExtra(chatId: number) {
  await tgSendMessage({
    chatId,
    text:
      `🧾 <b>Qo'shimcha ma'lumotni yozing</b>\n\n` +
      `Narx, miqdor, sana, telefon yoki manzil — bir xabarda yozib yuboring.`,
    replyMarkup: {
      inline_keyboard: [
        askRow("⏭ Ma'lumotsiz davom etish", "a:extra:no"),
        askRow("🗑 Bekor qilish", "a:cancel"),
      ],
    },
  });
}

// ─── Yozish (copywriting) va preview ─────────────────────────────────────

function previewKeyboard(count: number): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: `📤 Yuborish (${count} guruh)`, callback_data: "a:send" }],
      [
        { text: "✏️ Matnni tahrirlash", callback_data: "a:edit" },
        { text: "🔄 Qayta yozish", callback_data: "a:regen" },
      ],
      [
        { text: "👥 Guruhlarni tanlash", callback_data: "a:groups" },
        { text: "🔁 Savollarni qaytadan", callback_data: "a:restart" },
      ],
      [{ text: "🗑 Bekor qilish", callback_data: "a:cancel" }],
    ],
  };
}

function groupKeyboard(gl: GroupRow[], selected: number[]): InlineKeyboard {
  const rows: InlineKeyboard["inline_keyboard"] = gl.map((g) => {
    const title = g.title.length > 40 ? `${g.title.slice(0, 39)}…` : g.title;
    const members = g.memberCount != null ? ` · ${g.memberCount}` : "";
    return [
      {
        text: `${selected.includes(g.id) ? "✅" : "⬜️"} ${title}${members}`,
        callback_data: `a:g:${g.id}`,
      },
    ];
  });
  rows.push([
    { text: "☑️ Barchasi", callback_data: "a:all" },
    { text: "◻️ Tozalash", callback_data: "a:none" },
  ]);
  rows.push([
    { text: "✅ Tayyor", callback_data: "a:back" },
    { text: "🗑 Bekor qilish", callback_data: "a:cancel" },
  ]);
  return { inline_keyboard: rows };
}

/**
 * Tayyor matnni (rasm bilan birga) foydalanuvchining o'ziga ko'rsatadi —
 * ya'ni guruhlarga ketadigan ko'rinishning aynan o'zi.
 */
async function showPreview(
  chatId: number,
  userId: number,
  draft: Draft,
  session: AgentSession,
  note: string | null,
) {
  const text = (session.text || "").trim();
  const { title, body } = splitTitleBody(text);
  const category = resolveCategory(session);
  const rendered = formatPost({ title, body, category });

  const gl = await asGroups();
  const stored = ((draft.selectedGroupIds as number[]) || []).filter((id) =>
    gl.some((g) => g.id === id),
  );
  const selected = stored.length > 0 ? stored : pickGroups(gl, category);

  // Guruhlarga aynan qanday ketishini ko'rsatamiz
  if (draft.type === "photo" && draft.fileId) {
    if (rendered.length + 40 <= CAPTION_LIMIT) {
      await tgSendPhotoFileId({
        chatId,
        fileId: draft.fileId,
        caption: rendered,
      });
    } else {
      await tgSendPhotoFileId({ chatId, fileId: draft.fileId });
      await tgSendMessage({ chatId, text: rendered });
    }
  } else {
    await tgSendMessage({ chatId, text: rendered || "(matn bo'sh)" });
  }

  const tag = categoryHashtag(category);
  const lines = [
    `✅ <b>Post tayyor</b>`,
    ``,
    `🎯 Yo'nalish: <b>${categoryLabelUz(category)}</b>`,
    `✍️ Uslub: ${lengthLabelUz(session.answers.length)}`,
    `🔗 Havola: ${session.answers.link ? "bor" : "yo'q"}`,
    `👥 Guruhlar: <b>${selected.length}</b> ta — ${groupSummary(gl, selected)}`,
    `#️⃣ Hashtag: ${tag ? `<code>${tag}</code> (guruh bo'yicha)` : "yo'q"}`,
  ];
  if (note) lines.push(``, note);
  lines.push(
    ``,
    `Kerak bo'lsa tahrirlang yoki qayta yozing, so'ng <b>Yuborish</b> tugmasini bosing.`,
  );
  const summary = lines.join("\n");

  const res = await tgSendMessage({
    chatId,
    text: summary,
    replyMarkup: previewKeyboard(selected.length),
  });
  if (res.ok && res.result) {
    await saveSession(userId, session, {
      selectedGroupIds: selected,
      controlMessageId: res.result.message_id,
    });
  }
}

async function generatePost(
  chatId: number,
  userId: number,
  draft: Draft,
  session: AgentSession,
) {
  await tgCall("sendChatAction", { chat_id: chatId, action: "typing" });

  const gl = await asGroups();
  const category = resolveCategory(session);
  const input = toWriteInput(session, category, gl);

  const result = await writePost(input);

  // Fine-tuning xomashyosi: aynan shu prompt juftligi + yozilgan matn
  await recordDialogFor(draft.id, userId, input, result);

  const next: AgentSession = {
    ...session,
    stage: "ready",
    step: 4,
    text: result.text,
    tries: session.tries + 1,
  };
  await saveSession(userId, next);

  await showPreview(
    chatId,
    userId,
    draft,
    next,
    result.fellBack
      ? "⚠️ AI javob bermadi — oddiy shablon ishlatildi. Qayta yozib ko'ring."
      : result.provider === "template"
        ? "⚠️ AI kaliti sozlanmagan (<code>AI_API_KEY</code>) — oddiy shablon ishlatildi."
        : `✍️ Matn AI (${result.provider}) orqali yozildi.`,
  );
}

async function showGroups(
  chatId: number,
  userId: number,
  draft: Draft,
  session: AgentSession,
) {
  const gl = await asGroups();
  const selected = ((draft.selectedGroupIds as number[]) || []).filter((id) =>
    gl.some((g) => g.id === id),
  );
  if (gl.length === 0) {
    await tgSendMessage({
      chatId,
      text: "📭 Hali guruhlar yo'q. Meni guruhga admin qilib qo'shing.",
    });
    return;
  }
  const res = await tgSendMessage({
    chatId,
    text:
      `👥 <b>Guruhlarni tanlang</b>\n\n` +
      `Tanlangan: <b>${selected.length}</b> ta.\n` +
      `Belgini bosib yoqish/o'chirish, so'ng <b>Tayyor</b> ni bosing.`,
    replyMarkup: groupKeyboard(gl, selected),
  });
  if (res.ok && res.result) {
    await saveSession(userId, session, {
      selectedGroupIds: selected,
      controlMessageId: res.result.message_id,
    });
  }
}

// ─── Yuborish ────────────────────────────────────────────────────────────

async function doSend(
  chatId: number,
  userId: number,
  draft: Draft,
  session: AgentSession,
  messageId: number,
) {
  const gl = await asGroups();
  let selected = ((draft.selectedGroupIds as number[]) || []).filter((id) =>
    gl.some((g) => g.id === id),
  );
  if (selected.length === 0) selected = pickGroups(gl, resolveCategory(session));

  if (selected.length === 0) {
    await tgSendMessage({
      chatId,
      text:
        "📭 Guruhlar topilmadi. Meni guruhga admin qilib qo'shing, " +
        "so'ng qayta urinib ko'ring.",
    });
    return;
  }

  const text = (session.text || "").trim();
  if (!text) {
    await tgSendMessage({
      chatId,
      text: "⚠️ Matn yo'q. «🔄 Qayta yozish» tugmasini bosing.",
    });
    return;
  }

  const { title, body } = splitTitleBody(text);
  const [post] = await db
    .insert(posts)
    .values({
      title,
      body,
      imageFileId: draft.type === "photo" ? draft.fileId : null,
      status: "sending",
      source: "bot",
    })
    .returning();

  await tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: `⏳ ${selected.length} ta guruhga yuborilmoqda...`,
  });

  const result = await distributePost(
    post.id,
    selected.map((groupId) => ({ groupId })),
  );

  await db.delete(botDrafts).where(eq(botDrafts.telegramUserId, userId));

  await tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "HTML",
    text:
      `✅ <b>Yuborildi!</b>\n\n` +
      `Muvaffaqiyatli: <b>${result.sent}</b>\n` +
      (result.failed ? `Xato: <b>${result.failed}</b>\n` : "") +
      `\nTarixni panelda ko'rishingiz mumkin.`,
  });
}

// ─── Kirish nuqtalari (webhook shularni chaqiradi) ───────────────────────

/** Yangi poster/matn keldi — agent suhbatini boshlaymiz (yoki qaytadan). */
export async function startAgent(params: {
  chatId: number;
  userId: number;
  brief: string | null;
  type: "text" | "photo";
  fileId: string | null;
}) {
  const brief = (params.brief ?? "").trim();
  const session = newSession(brief);

  // Profil qiziqishi (m:farming/m:livestock yoki matn tahlili) — brief
  // o'zidan yo'nalish aniqlanmasa, yo'nalishni profilega moslab oldindan
  // tanlaymiz. Foydalanuvchi Q1 savolida xohlasa o'zgartiradi.
  if (!session.answers.category && !detectCategoryFromText(brief)) {
    try {
      const rows = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.telegramUserId, params.userId));
      const interest = rows[0]?.interest;
      if (interest === "farming") session.answers.category = "agro";
      else if (interest === "livestock") session.answers.category = "ferma";
    } catch (e) {
      console.error("startAgent profile interest:", e);
    }
  }

  await db
    .insert(botDrafts)
    .values({
      telegramUserId: params.userId,
      type: params.type,
      text: brief || null,
      fileId: params.fileId,
      selectedGroupIds: [],
      session,
      controlMessageId: null,
    })
    .onConflictDoUpdate({
      target: botDrafts.telegramUserId,
      set: {
        type: params.type,
        text: brief || null,
        fileId: params.fileId,
        selectedGroupIds: [],
        session,
        controlMessageId: null,
        updatedAt: new Date(),
      },
    });

  if (session.stage === "awaiting_brief") {
    await askBrief(params.chatId);
    return;
  }

  // Mavzu bor — tasdiqlab, birinchi savolga o'tamiz
  const echo = brief.length > 120 ? `${brief.slice(0, 119)}…` : brief;
  await tgSendMessage({
    chatId: params.chatId,
    text:
      `📥 Qabul qildim:\n<i>${escapeHtml(echo)}</i>\n\n` +
      `Endi 4 ta qisqa savol beraman — matnni o'zim yozaman.`,
  });
  await askStep(params.chatId, session);
}
/**
 * Suhbat davomida kelgan matn: mavzu, havola, qo'shimcha ma'lumot yoki
 * tayyor matnning yangi varianti. `true` — matn ishlatildi (bu yangi post emas).
 */
export async function handleAgentText(
  chatId: number,
  userId: number,
  text: string,
): Promise<boolean> {
  const draft = await loadDraft(userId);
  if (!draft) return false;

  const session = sessionOf(draft);
  const clean = text.trim();
  if (!clean) return false;

  if (session.stage === "awaiting_brief") {
    const next: AgentSession = {
      ...session,
      brief: clean,
      stage: "questions",
      step: 0,
    };
    await saveSession(userId, next, { text: clean });
    await askStep(chatId, next);
    return true;
  }

  if (session.stage === "awaiting_link") {
    if (!looksLikeLink(clean)) {
      await tgSendMessage({
        chatId,
        text:
          `🤔 Bu havolaga o'xshamadi.\n\n` +
          `Havolani yuboring (masalan <code>https://t.me/kanal</code>) yoki ` +
          `havolasiz davom etish uchun tugmani bosing.`,
        replyMarkup: {
          inline_keyboard: [
            askRow("⏭ Havolasiz davom etish", "a:link:no"),
            askRow("🗑 Bekor qilish", "a:cancel"),
          ],
        },
      });
      return true;
    }
    const link = normalizeLink(clean);
    const next: AgentSession = {
      ...session,
      stage: "questions",
      step: 3,
      answers: { ...session.answers, needLink: true, link },
    };
    await saveSession(userId, next);
    await tgSendMessage({
      chatId,
      text: `🔗 Havola qo'shildi: ${escapeHtml(link)}`,
    });
    await askStep(chatId, next);
    return true;
  }

  if (session.stage === "awaiting_extra") {
    const next: AgentSession = {
      ...session,
      stage: "questions",
      step: 4,
      answers: { ...session.answers, extra: clean },
    };
    await saveSession(userId, next);
    await tgSendMessage({
      chatId,
      text: "🧾 Qo'shimcha ma'lumot qabul qilindi.",
    });
    await generatePost(chatId, userId, draft, next);
    return true;
  }

  if (session.stage === "editing") {
    const next: AgentSession = { ...session, stage: "ready", text: clean };
    await saveSession(userId, next);

    // Ekspert tahriri — "to'g'ri javob" namunalari shu yerdan yig'iladi
    // (provider="human", verified=false; panelda tasdiqlanib o'qitishga ketadi)
    if (clean !== (session.text ?? "").trim()) {
      const gl = await asGroups();
      const input = toWriteInput(next, resolveCategory(next), gl);
      await recordDialogFor(draft.id, userId, input, {
        text: clean,
        provider: "human",
      });
    }

    await showPreview(chatId, userId, draft, next, "✏️ Matnni siz tahrirladingiz.");
    return true;
  }

  return false;
}

/**
 * `a:*` callback'lar: savollarga javob, preview tugmalari, guruh tanlash.
 * `data` — allaqachon normallashtirilgan qiymat (webhook legacy kalitlarni
 * ham shu ko'rinishga keltiradi).
 */
export async function handleAgentCallback(cb: TgCallback, data: string) {
  const userId = cb.from.id;
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  if (!chatId || !messageId) return;

  const answer = (text?: string, showAlert?: boolean) =>
    tgCall("answerCallbackQuery", {
      callback_query_id: cb.id,
      text,
      show_alert: showAlert || undefined,
    });
  const edit = (text: string) =>
    tgCall("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
    });

  let draft = await loadDraft(userId);
  if (!draft) {
    await answer("Post topilmadi — poster yoki matnni qaytadan yuboring.", true);
    return;
  }
  const session = sessionOf(draft);
  const gl = await asGroups();

  if (data === "a:cancel") {
    await db.delete(botDrafts).where(eq(botDrafts.telegramUserId, userId));
    await edit("❌ Bekor qilindi. Yangi post uchun poster yoki matn yuboring.");
    await answer("Bekor qilindi");
    return;
  }

  // ── 1-savol: yo'nalish ────────────────────────────────────────────────
  if (data.startsWith("a:cat:")) {
    const v = data.slice(6);
    const category: AgentCategory =
      v === "auto"
        ? (detectCategoryFromText(session.brief) ?? "boshqa")
        : (v as AgentCategory);
    const selected = pickGroups(gl, category);
    const next: AgentSession = {
      ...session,
      stage: "questions",
      step: 1,
      answers: { ...session.answers, category },
    };
    await saveSession(userId, next, { selectedGroupIds: selected });
    await edit(
      `🎯 Yo'nalish: <b>${categoryLabelUz(category)}</b>` +
        (v === "auto" ? " <i>(mavzudan aniqlandi)</i>" : ""),
    );
    await answer(`Guruhlar: ${selected.length} ta tanlandi`);
    await askStep(chatId, next);
    return;
  }

  // ── 2-savol: uslub / uzunlik ──────────────────────────────────────────
  if (data.startsWith("a:len:")) {
    const v = data.slice(6);
    const length = v === "auto" ? null : (v as "short" | "medium" | "long");
    const next: AgentSession = {
      ...session,
      stage: "questions",
      step: 2,
      answers: { ...session.answers, length },
    };
    await saveSession(userId, next);
    await edit(`✍️ Uslub: <b>${lengthLabelUz(length)}</b>`);
    await answer("Qabul qilindi");
    await askStep(chatId, next);
    return;
  }

  // ── 3-savol: havola ───────────────────────────────────────────────────
  if (data === "a:link:yes") {
    const next: AgentSession = {
      ...session,
      stage: "awaiting_link",
      step: 2,
      answers: { ...session.answers, needLink: true },
    };
    await saveSession(userId, next);
    await edit("🔗 Havola: <b>ha</b>");
    await answer();
    await askLink(chatId);
    return;
  }
  if (data === "a:link:no") {
    const next: AgentSession = {
      ...session,
      stage: "questions",
      step: 3,
      answers: { ...session.answers, needLink: false, link: null },
    };
    await saveSession(userId, next);
    await edit("🔗 Havola: <b>yo'q</b>");
    await answer();
    await askStep(chatId, next);
    return;
  }

  // ── 4-savol: qo'shimcha ma'lumot ──────────────────────────────────────
  if (data === "a:extra:yes") {
    const next: AgentSession = {
      ...session,
      stage: "awaiting_extra",
      step: 3,
    };
    await saveSession(userId, next);
    await edit("🧾 Qo'shimcha ma'lumot: <b>kutilmoqda</b>");
    await answer();
    await askExtra(chatId);
    return;
  }
  if (data === "a:extra:no") {
    const next: AgentSession = {
      ...session,
      stage: "questions",
      step: 4,
      answers: { ...session.answers, extra: null },
    };
    await saveSession(userId, next);
    await edit("🧾 Qo'shimcha ma'lumot: <b>yo'q</b>");
    await answer();
    await generatePost(chatId, userId, draft, next);
    return;
  }

  // ── Preview tugmalari ─────────────────────────────────────────────────
  if (data === "a:done") {
    await edit("⏭ Savollar tugatildi — matn yozilmoqda...");
    await answer();
    await generatePost(chatId, userId, draft, session);
    return;
  }
  if (data === "a:regen") {
    await edit("🔄 Matn qaytadan yozilmoqda...");
    await answer();
    await generatePost(chatId, userId, draft, session);
    return;
  }
  if (data === "a:edit") {
    const next: AgentSession = { ...session, stage: "editing" };
    await saveSession(userId, next);
    await edit(
      `✏️ <b>Yangi matnni yuboring</b>\n\n` +
        `Keyingi xabaringiz post matni sifatida ishlatiladi.`,
    );
    await answer();
    return;
  }
  if (data === "a:restart") {
    const next: AgentSession = {
      ...session,
      stage: "questions",
      step: 0,
      answers: {
        category: null,
        length: null,
        needLink: null,
        link: null,
        extra: null,
      },
    };
    await saveSession(userId, next);
    await edit("🔁 Savollarni qaytadan boshlaymiz.");
    await answer();
    await askStep(chatId, next);
    return;
  }
  if (data === "a:groups") {
    await edit("👥 Guruh tanlash ekrani ⤵️");
    await answer();
    await showGroups(chatId, userId, draft, session);
    return;
  }

  // ── Guruhlarni belgilash ──────────────────────────────────────────────
  if (data.startsWith("a:g:") || data === "a:all" || data === "a:none") {
    draft = (await loadDraft(userId)) ?? draft;
    let selected = ((draft.selectedGroupIds as number[]) || []).filter((id) =>
      gl.some((g) => g.id === id),
    );
    if (data.startsWith("a:g:")) {
      const gid = Number(data.slice(4));
      selected = selected.includes(gid)
        ? selected.filter((x) => x !== gid)
        : [...selected, gid];
    } else if (data === "a:all") {
      selected = gl.map((g) => g.id);
    } else {
      selected = [];
    }
    await saveSession(userId, session, { selectedGroupIds: selected });
    await tgCall("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: groupKeyboard(gl, selected),
    });
    await answer(`Tanlangan: ${selected.length} ta`);
    return;
  }

  if (data === "a:back") {
    draft = (await loadDraft(userId)) ?? draft;
    const selected = ((draft.selectedGroupIds as number[]) || []).filter((id) =>
      gl.some((g) => g.id === id),
    );
    await edit(`👥 Guruhlar: <b>${selected.length}</b> ta tanlandi ✅`);
    await answer();
    await showPreview(chatId, userId, draft, session, "👥 Guruhlar yangilandi.");
    return;
  }

  if (data === "a:send") {
    draft = (await loadDraft(userId)) ?? draft;
    await answer("Yuborilmoqda...");
    await doSend(chatId, userId, draft, session, messageId);
    return;
  }

  await answer("Tugma eskirgan — postni qaytadan yuboring.", true);
}
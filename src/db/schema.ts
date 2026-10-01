import {
  pgTable,
  serial,
  text,
  bigint,
  boolean,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

// Agent suhbatining holati (faqat tip — runtime tsikl bo'lmaydi)
import type { AgentSession } from "@/lib/agent/types";
// Dialog namunasi holati (faqat tip — runtime tsikl bo'lmaydi)
import type { DialogMessage } from "@/lib/dialogs";

// Telegram guruhlari (Agro dehqonchilik, Ferma va chorvachilik, ...)
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull().unique(),
  title: text("title").notNull().default(""),
  username: text("username"),
  // category: "agro" | "ferma" | "boshqa"
  category: text("category").notNull().default("boshqa"),
  isForum: boolean("is_forum").notNull().default(false),
  active: boolean("active").notNull().default(true),
  // service xabarlarni (kirdi/chiqdi) tozalash
  cleanJoinLeave: boolean("clean_join_leave").notNull().default(true),
  // getChatMemberCount natijasi (syncGroup yangilab turadi)
  memberCount: integer("member_count"),
  // Bot guruhda adminmi va xabar o'chirish huquqi bormi
  // (kirdi/chiqdi tozalash faqat shunda ishlaydi)
  botIsAdmin: boolean("bot_is_admin").notNull().default(false),
  botCanDelete: boolean("bot_can_delete").notNull().default(false),
  memberCountUpdatedAt: timestamp("member_count_updated_at", {
    withTimezone: true,
  }),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

// Forum guruhlardagi mavzular (topic / thread)
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  threadId: bigint("thread_id", { mode: "number" }).notNull(),
  name: text("name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Yuborilgan / yuboriladigan postlar
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  imageData: text("image_data"), // base64
  imageMime: text("image_mime"),
  imageFileId: text("image_file_id"), // telegram file_id (botdan kelsa)
  // status: "draft" | "sending" | "sent" | "failed" | "partial"
  status: text("status").notNull().default("draft"),
  source: text("source").notNull().default("web"), // "web" | "bot"
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Har bir post qaysi guruhga/mavzuga yuborilgani
export const postTargets = pgTable("post_targets", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  threadId: bigint("thread_id", { mode: "number" }),
  messageId: bigint("message_id", { mode: "number" }),
  status: text("status").notNull().default("pending"), // pending|sent|failed
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

// Bot adminlari (telegram userlari)
export const botAdmins = pgTable("bot_admins", {
  id: serial("id").primaryKey(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" })
    .notNull()
    .unique(),
  username: text("username"),
  firstName: text("first_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Botdagi "panel" uchun vaqtincha draftlar (admin botga xabar yuborганda)
// Foydalanuvchi profili: menyu qiziqishi (farming/livestock) va vaqtincha
// rejim. Bot_admins dan alohida — oddiy foydalanuvchilar (dehqonlar) ham
// rasmli tashxisdan foydalanadi, ularga adminlik berilmasligi kerak.
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" })
    .notNull()
    .unique(),
  username: text("username"),
  firstName: text("first_name"),
  // "farming" (dehqonchilik/ekin) | "livestock" (chorva/parranda) | null
  interest: text("interest"),
  // "diagnose" — keyingi rasm tashxis uchun | null
  pendingMode: text("pending_mode"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const botDrafts = pgTable("bot_drafts", {
  id: serial("id").primaryKey(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" })
    .notNull()
    .unique(),
  type: text("type").notNull().default("text"), // text|photo
  text: text("text"),
  fileId: text("file_id"),
  selectedGroupIds: jsonb("selected_group_ids").$type<number[]>().default([]),
  // Agent suhbatining holati (savollar → preview → yuborish)
  session: jsonb("session").$type<AgentSession>(),
  controlMessageId: bigint("control_message_id", { mode: "number" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Fine-tuning xomashyosi: har bir qator bitta JSONL namunasi —
// {messages:[{role,content}...]}. `verified = true` qatorlar o'qitishga ketadi.
export const dialogs = pgTable("dialogs", {
  id: serial("id").primaryKey(),
  // Bir suhbatdagi qayta yozish/tahrirlarni birlashtiruvchi kalit
  conversationId: text("conversation_id").notNull(),
  // "bot" (hozir), kelajakda "instagram" va h.k.
  source: text("source").notNull().default("bot"),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }),
  // O'qitish namunasi: [{role, content}, ...] — export'da aynan shu JSONL qatori
  messages: jsonb("messages").$type<DialogMessage[]>().notNull(),
  // "openai" | "gemini" | "template" | "human" — matn qaysi manbadan
  provider: text("provider").notNull().default("template"),
  // Faqat tasdiqlangan juftliklar o'qitishga tayyor
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Statistika / log
export const cleanLog = pgTable("clean_log", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id, {
    onDelete: "set null",
  }),
  kind: text("kind").notNull(), // join|leave
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Group = typeof groups.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostTarget = typeof postTargets.$inferSelect;
export type Dialog = typeof dialogs.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;

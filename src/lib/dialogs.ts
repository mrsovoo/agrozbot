// Fine-tuning (LoRA/QLoRA) uchun dialog yig'uvchi modul.
//
// Har bir yozuv — o'qitishning bitta namunasi va aynan JSONL qatoriga teng:
//   {"messages":[{"role":"system",...},{"role":"user",...},{"role":"assistant",...}]}
// Yig'ilgan xomashyo keyin /api/dialogs/export orqali JSONL faylga aylanadi.
//
// Qoidalar:
// - `recordDialog()` hech qachon xato tashlamaydi — logging agent ishini
//   to'xtatmasligi kerak (xatolik faqat console'ga chiqadi).
// - O'qitishga FAQAT `verified = true` qatorlar ketadi. Tasdiqlash/tahrirlash
//   `PATCH /api/dialogs/[id]` orqali; ekspert tahriri (provider="human") ham
//   shu yerga yoziladi — ular eng yuqori sifatli namunalar.

import { db } from "@/db";
import { dialogs } from "@/db/schema";

export type DialogMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RecordDialogInput = {
  // Bir suhbatdagi qayta yozish/tahrirlarni birlashtiruvchi kalit
  // (masalan `draft:12` — draft id bo'yicha).
  conversationId: string;
  telegramUserId: number | null;
  messages: DialogMessage[];
  // "openai" | "gemini" | "template" | "human"
  provider: string;
  // "bot" (hozir), kelajakda "instagram" va h.k.
  source?: string;
};

export async function recordDialog(input: RecordDialogInput): Promise<void> {
  try {
    await db.insert(dialogs).values({
      conversationId: input.conversationId,
      telegramUserId: input.telegramUserId,
      messages: input.messages,
      provider: input.provider,
      source: input.source ?? "bot",
    });
  } catch (err) {
    console.error("[dialogs] yozib bo'lmadi:", err);
  }
}

/** Qatorlarni toza JSONL faylga aylantiradi: bir qator = bitta namuna. */
export function dialogsToJsonl(rows: { messages: DialogMessage[] }[]): string {
  if (rows.length === 0) return "";
  return (
    rows.map((r) => JSON.stringify({ messages: r.messages })).join("\n") + "\n"
  );
}

const ROLES = new Set(["system", "user", "assistant"]);

/**
 * Kirishdagi messages massivini tekshirib qabul qiladi; noto'g'ri bo'lsa null.
 * Oxirgi yozuv ASSISTANT bo'lishi shart — o'qitish namunasi shunday tugaydi.
 */
export function parseDialogMessages(raw: unknown): DialogMessage[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: DialogMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (typeof role !== "string" || !ROLES.has(role)) return null;
    if (typeof content !== "string" || !content.trim()) return null;
    out.push({ role: role as DialogMessage["role"], content });
  }
  if (out[out.length - 1].role !== "assistant") return null;
  return out;
}
// Telegram Bot API bilan ishlash uchun yordamchi funksiyalar

export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

const API_BASE = "https://api.telegram.org";

type TgResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

export async function tgCall<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<TgResponse<T>> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN sozlanmagan" };
  }
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as TgResponse<T>;
    return data;
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : "Network error",
    };
  }
}

// Rasmni (bufferdan) multipart orqali yuborish
export async function tgSendPhotoBuffer(params: {
  chatId: number;
  buffer: Buffer;
  mime: string;
  caption?: string;
  threadId?: number | null;
  parseMode?: string;
}): Promise<TgResponse<{ message_id: number }>> {
  const token = getBotToken();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN sozlanmagan" };

  const form = new FormData();
  form.append("chat_id", String(params.chatId));
  if (params.threadId)
    form.append("message_thread_id", String(params.threadId));
  if (params.caption) form.append("caption", params.caption);
  form.append("parse_mode", params.parseMode ?? "HTML");
  const ext = params.mime.includes("png") ? "png" : "jpg";
  const blob = new Blob([new Uint8Array(params.buffer)], { type: params.mime });
  form.append("photo", blob, `poster.${ext}`);

  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    return (await res.json()) as TgResponse<{ message_id: number }>;
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function tgSendMessage(params: {
  chatId: number;
  text: string;
  threadId?: number | null;
  parseMode?: string;
  replyMarkup?: unknown;
}) {
  return tgCall<{ message_id: number }>("sendMessage", {
    chat_id: params.chatId,
    text: params.text,
    message_thread_id: params.threadId ?? undefined,
    parse_mode: params.parseMode ?? "HTML",
    reply_markup: params.replyMarkup,
    disable_web_page_preview: false,
  });
}

export async function tgSendPhotoFileId(params: {
  chatId: number;
  fileId: string;
  caption?: string;
  threadId?: number | null;
  parseMode?: string;
}) {
  return tgCall<{ message_id: number }>("sendPhoto", {
    chat_id: params.chatId,
    photo: params.fileId,
    caption: params.caption,
    message_thread_id: params.threadId ?? undefined,
    parse_mode: params.parseMode ?? "HTML",
  });
}

export async function tgDeleteMessage(chatId: number, messageId: number) {
  return tgCall("deleteMessage", { chat_id: chatId, message_id: messageId });
}

export async function tgGetFileBuffer(
  fileId: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const token = getBotToken();
  if (!token) return null;
  const fileRes = await tgCall<{ file_path: string }>("getFile", {
    file_id: fileId,
  });
  if (!fileRes.ok || !fileRes.result) return null;
  const path = fileRes.result.file_path;
  const res = await fetch(`${API_BASE}/file/bot${token}/${path}`);
  if (!res.ok) return null;
  const arr = await res.arrayBuffer();
  const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
  return { buffer: Buffer.from(arr), mime };
}

// HTML uchun xavfsiz matn
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Post matnini chiroyli formatlash
export function formatPost(opts: {
  title?: string;
  body?: string;
  category?: string;
}): string {
  const parts: string[] = [];
  if (opts.title && opts.title.trim()) {
    parts.push(`<b>${escapeHtml(opts.title.trim())}</b>`);
  }
  if (opts.body && opts.body.trim()) {
    parts.push(escapeHtml(opts.body.trim()));
  }
  const tag = categoryHashtag(opts.category);
  if (tag) parts.push(tag);
  return parts.join("\n\n");
}

export function categoryHashtag(category?: string): string {
  switch (category) {
    case "agro":
      return "#agro_dehqonchilik";
    case "ferma":
      return "#ferma_chorvachilik";
    default:
      return "";
  }
}

export function categoryLabel(category?: string): string {
  switch (category) {
    case "agro":
      return "🌾 Agro dehqonchilik";
    case "ferma":
      return "🐄 Ferma va chorvachilik";
    default:
      return "📋 Boshqa";
  }
}

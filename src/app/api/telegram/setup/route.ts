import { isAuthed } from "@/lib/auth";
import { tgCall, getBotToken } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// setWebhook bilan bir xil ro'yxat (scripts/telegram-setup.mjs ham shuni yuboradi)
const ALLOWED_UPDATES = [
  "message",
  "edited_message",
  "callback_query",
  "my_chat_member",
];

// Webhook holatini olish
export async function GET() {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const hasSecret = !!process.env.TELEGRAM_WEBHOOK_SECRET;
  const suggestedUrl = process.env.SITE_URL?.trim() || null;
  if (!getBotToken()) {
    return Response.json({
      configured: false,
      message: "TELEGRAM_BOT_TOKEN sozlanmagan",
      hasSecret,
      suggestedUrl,
    });
  }
  const me = await tgCall("getMe");
  const info = await tgCall("getWebhookInfo");
  return Response.json({ configured: true, hasSecret, suggestedUrl, me, webhook: info });
}

// Webhook o'rnatish yoki o'chirish
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    url?: string;
  };

  if (body.action === "delete") {
    const res = await tgCall("deleteWebhook", { drop_pending_updates: false });
    return Response.json(res);
  }

  // set webhook
  const base = body.url?.trim();
  if (!base) {
    return Response.json(
      { ok: false, description: "URL kiritilmagan" },
      { status: 400 },
    );
  }
  if (!base.startsWith("https://")) {
    return Response.json(
      {
        ok: false,
        description:
          "Manzil https:// bilan boshlanishi kerak (Telegram faqat HTTPS qabul qiladi)",
      },
      { status: 400 },
    );
  }
  const webhookUrl = base.replace(/\/$/, "") + "/api/telegram/webhook";
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const res = await tgCall("setWebhook", {
    url: webhookUrl,
    secret_token: secret || undefined,
    allowed_updates: ALLOWED_UPDATES,
    drop_pending_updates: true,
  });
  return Response.json({ ...res, webhookUrl });
}

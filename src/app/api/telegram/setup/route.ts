import { isAuthed } from "@/lib/auth";
import { tgCall, getBotToken } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Webhook holatini olish
export async function GET() {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!getBotToken()) {
    return Response.json({
      configured: false,
      message: "TELEGRAM_BOT_TOKEN sozlanmagan",
    });
  }
  const me = await tgCall("getMe");
  const info = await tgCall("getWebhookInfo");
  return Response.json({ configured: true, me, webhook: info });
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
  const webhookUrl = base.replace(/\/$/, "") + "/api/telegram/webhook";
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const res = await tgCall("setWebhook", {
    url: webhookUrl,
    secret_token: secret || undefined,
    allowed_updates: [
      "message",
      "edited_message",
      "callback_query",
      "my_chat_member",
    ],
    drop_pending_updates: true,
  });
  return Response.json({ ...res, webhookUrl });
}

import { processUpdate } from "@/lib/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel: ko'p guruhga yuborish vaqt olishi mumkin
export const maxDuration = 60;

export async function POST(req: Request) {
  // Ixtiyoriy: secret token tekshiruvi
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return new Response("forbidden", { status: 403 });
    }
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await processUpdate(update as any);
  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({ ok: true, info: "Telegram webhook endpoint" });
}

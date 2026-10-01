import { isAuthed } from "@/lib/auth";
import { syncAllGroups } from "@/lib/groupMeta";

export const dynamic = "force-dynamic";

// A'zolar soni va botning admin holatini Telegram'dan qayta o'qib bazaga yozadi.
// Body: { id?: number } — faqat bitta guruhni yangilash uchun (ixtiyoriy).
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: number };
  const id = Number(body.id);
  const onlyIds = Number.isFinite(id) && id > 0 ? [id] : undefined;

  try {
    const summary = await syncAllGroups(onlyIds);
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: "sync_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
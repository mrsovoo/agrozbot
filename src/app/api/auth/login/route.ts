import { getAdminPassword, setSession, clearSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password !== getAdminPassword()) {
    return Response.json(
      { ok: false, error: "Parol noto'g'ri" },
      { status: 401 },
    );
  }
  await setSession();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await clearSession();
  return Response.json({ ok: true });
}

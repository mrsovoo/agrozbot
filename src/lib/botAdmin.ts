import { db } from "@/db";
import { botAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";

function envAdminIds(): number[] {
  const raw = process.env.BOT_ADMIN_IDS || "";
  return raw
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function isBotAdmin(userId: number): Promise<boolean> {
  if (envAdminIds().includes(userId)) return true;
  const rows = await db
    .select()
    .from(botAdmins)
    .where(eq(botAdmins.telegramUserId, userId));
  if (rows.length > 0) return true;

  // Agar hech qanday admin bo'lmasa (env ham, db ham bo'sh) -> birinchi foydalanuvchi admin bo'ladi
  const all = await db.select().from(botAdmins);
  if (all.length === 0 && envAdminIds().length === 0) {
    return true;
  }
  return false;
}

export async function ensureAdminRecorded(user: {
  id: number;
  username?: string;
  first_name?: string;
}) {
  const all = await db.select().from(botAdmins);
  if (all.length === 0 && envAdminIds().length === 0) {
    // birinchi foydalanuvchini avtomatik admin qilamiz
    await db
      .insert(botAdmins)
      .values({
        telegramUserId: user.id,
        username: user.username ?? null,
        firstName: user.first_name ?? null,
      })
      .onConflictDoNothing();
  }
}

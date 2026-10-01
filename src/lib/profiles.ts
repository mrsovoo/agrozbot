// Foydalanuvchi profili: menyu qiziqishi (farming/livestock) va vaqtincha
// rejimlar (masalan rasmli tashxis). `user_profiles` jadvalida saqlanadi.
//
// Qiziqish ikki usulda belgilanadi:
//   1) /start menyusidan qo'lda tanlash (m:farming | m:livestock);
//   2) matndan avtomatik aniqlash — foydalanuvchi ko'proq qaysi soha
//      haqida yozsa (kalit so'zlar), profil shu sohaga o'tkaziladi.

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Interest = "farming" | "livestock";

type ProfileUser = {
  id: number;
  username?: string;
  first_name?: string;
};

export async function getUserProfile(userId: number) {
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.telegramUserId, userId));
  return rows[0] ?? null;
}

/** Profil yaratadi yoki qisman yangilaydi (faqat berilgan maydonlar). */
export async function upsertUserProfile(
  user: ProfileUser,
  patch: { interest?: Interest; pendingMode?: string | null },
) {
  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: now };
  if (patch.interest !== undefined) set.interest = patch.interest;
  if (patch.pendingMode !== undefined) set.pendingMode = patch.pendingMode;
  if (user.username !== undefined) set.username = user.username;
  if (user.first_name !== undefined) set.firstName = user.first_name;

  await db
    .insert(userProfiles)
    .values({
      telegramUserId: user.id,
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      interest: patch.interest ?? null,
      pendingMode: patch.pendingMode ?? null,
    })
    .onConflictDoUpdate({ target: userProfiles.telegramUserId, set });
}

/** Tashxis rejimini o'chiradi (rasm kelgach yoki /start). */
export async function clearPendingMode(userId: number) {
  await db
    .update(userProfiles)
    .set({ pendingMode: null, updatedAt: new Date() })
    .where(eq(userProfiles.telegramUserId, userId));
}

// Kalit so'zlar (lotin; apostrof/oʻ harflari har qanday ko'rinishda)
const FARMING_RE =
  /(ekin|kasallik|zararkunanda|o['ʻ]?g['ʻ]?it|urug['ʻ]|pomidor|bodring|paxta|bug['ʻ]?doy|arpa|makkajo['ʻ]?xori|beda|issiqxona|bog['ʻ]|sabzavot|mevali|purkash|pestitsid|fungitsid|insektitsid|herbisid|ekish|sug['ʻ]?orish|kultivator|aksiler|kompass)/iu;
const LIVESTOCK_RE =
  /(chorva|sigir|qoramol|qo['ʻ]?y|echki|tovuq|parranda|veterinar|ozuqa|sut|boqqon|broiler|broyler|emxi|emlash|to['ʻ]?m |oxo|go['s]t)/iu;

/**
 * Matnga qarab qiziqish sohasini taxmin qiladi.
 * Ikkalasi ham mos kelsa yoki hech biri mos kelmasa — null (profil o'zgarmaydi).
 */
export function classifyInterest(text: string): Interest | null {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  const farming = FARMING_RE.test(t);
  const livestock = LIVESTOCK_RE.test(t);
  if (farming && !livestock) return "farming";
  if (livestock && !farming) return "livestock";
  return null;
}
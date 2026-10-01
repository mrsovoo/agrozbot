import { db } from "@/db";
import { groups } from "@/db/schema";
import { eq } from "drizzle-orm";

// Faol (bot chiqarilmagan) guruhlar — webhook ham, agent ham ishlatadi.
// Alohida faylda: aks holda webhook.ts ↔ agent/flow.ts o'rtasida sikl import bo'lardi.
export async function activeGroups() {
  return db.select().from(groups).where(eq(groups.active, true));
}
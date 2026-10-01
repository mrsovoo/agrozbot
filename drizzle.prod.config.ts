// Production (Vercel / Neon / Supabase) bazasiga jadvallarni yuborish uchun.
// Ishlatish:
//   DATABASE_URL="postgresql://..." npx drizzle-kit push --config=drizzle.prod.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL o'rnatilmagan");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});

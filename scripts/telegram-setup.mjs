#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// Telegram webhook'ni terminaldan bir marta o'rnatish/tekshirish.
// Kerakli o'zgaruvchilar (.env avtomatik o'qiladi):
//   TELEGRAM_BOT_TOKEN      — @BotFather tokeni (majburiy)
//   SITE_URL                — ommaviy domen, masalan https://agrozbot.vercel.app
//   TELEGRAM_WEBHOOK_SECRET — ixtiyoriy, lekin tavsiya etiladi
//
// Ishlatish:
//   npm run telegram:doctor                                ← to'liq diagnostika
//                                                            (guruhlar, a'zolar
//                                                             soni, bot adminmi)
//   npm run telegram:info                                  ← faqat bot/webhook holati
//   npm run telegram:set -- --url https://agrozbot.vercel.app
//   npm run telegram:delete
//
// ESLATMA: hech qachon api.telegram.org manzilini qo'lda yozmang va
// < > placeholder belgilarini kiritmang — Telegram 404 Not Found qaytaradi.
// ─────────────────────────────────────────────────────────────

import "dotenv/config";

const API_BASE = "https://api.telegram.org";
const ALLOWED_UPDATES = [
  "message",
  "edited_message",
  "callback_query",
  "my_chat_member",
];

const action = (process.argv[2] || "info").toLowerCase();

function flag(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? (process.argv[index + 1] ?? "") : null;
}

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

// Hujjatlardagi <...> placeholderlari ko'chirilib qolsa ham ishlashi uchun tozalash.
// Masalan foydalanuvchi "bot<123:AA...>" yoki "https://<https://domen>/api/webhook"
// yozsa — avtomatik to'g'rilanadi (Telegram bunday qatorni 404 Not Found qaytaradi).
function sanitize(value) {
  return String(value ?? "")
    .replace(/[<>"'`]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

// Har qanday kiritmani "https://domen" ko'rinishiga keltiradi.
// Path qismi tashlanadi — webhook manzilini skript o'zi qo'shadi.
function toBaseUrl(raw) {
  let value = sanitize(raw).replace(/(https?:\/\/)+/gi, "https://");
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const token = sanitize(process.env.TELEGRAM_BOT_TOKEN);
if (!token) {
  fail(
    "TELEGRAM_BOT_TOKEN topilmadi.\n" +
      "   Lokalda: cp .env.example .env → .env ga tokenni yozing\n" +
      "   Vercel'da: Settings → Environment Variables ga qo'shing",
  );
}
if (/[<>]/.test(process.env.TELEGRAM_BOT_TOKEN || "")) {
  console.warn(
    "⚠️  Tokendagi < > belgilari olib tashlandi — ularni yozmaslik kerak.\n",
  );
}
if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
  console.warn(
    "⚠️  Token formati @BotFather tokeniga o'xshamaydi (123456789:AA... ko'rinishida bo'ladi).",
  );
}

async function tg(method, params = {}) {
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : "Network error",
    };
  }
}

async function showInfo() {
  const me = await tg("getMe");
  if (!me.ok) {
    fail(`Bot tokeni tekshirilmadi: ${me.description}`);
  }
  const info = await tg("getWebhookInfo");
  const webhook = info.result || {};
  console.log(`\n🤖 Bot: @${me.result.username} (${me.result.first_name})`);
  console.log(`🔗 Webhook: ${webhook.url || "o'rnatilmagan"}`);
  console.log(`📥 Kutilayotgan yangilanishlar: ${webhook.pending_update_count ?? 0}`);
  if (webhook.last_error_message) {
    console.log(
      `⚠️  Oxirgi xato (${webhook.last_error_date ?? "?"}): ${webhook.last_error_message}`,
    );
  }
  console.log(
    `🔐 Secret token: ${
      process.env.TELEGRAM_WEBHOOK_SECRET ? "sozlangan" : "yo'q (ixtiyoriy)"
    }`,
  );
  console.log(`🌐 SITE_URL: ${process.env.SITE_URL || "ko'rsatilmagan"}\n`);
}

async function setWebhook() {
  const base = toBaseUrl(flag("url") || process.env.SITE_URL || "");
  if (!base) {
    fail(
      "Manzil ko'rsatilmagan yoki noto'g'ri.\n" +
        "   npm run telegram:set -- --url https://agrozbot.vercel.app\n" +
        "   yoki .env da SITE_URL ni to'ldiring",
    );
  }
  if (!base.startsWith("https://")) {
    fail("Telegram webhook uchun faqat HTTPS manzilni qabul qiladi (https:// ...).");
  }

  const secret = sanitize(
    flag("secret") || process.env.TELEGRAM_WEBHOOK_SECRET || "",
  );
  // Path qismi ataylab tashlanadi: bazaviy domenni olib, o'zimiz qo'shamiz
  const webhookUrl = `${base}/api/telegram/webhook`;

  const res = await tg("setWebhook", {
    url: webhookUrl,
    secret_token: secret || undefined,
    allowed_updates: ALLOWED_UPDATES,
    drop_pending_updates: true,
  });
  if (!res.ok) {
    fail(`Webhook o'rnatilmadi: ${res.description}`);
  }
  console.log(`✅ Webhook o'rnatildi: ${webhookUrl}`);
  await showInfo();
}

async function deleteWebhook() {
  const res = await tg("deleteWebhook", { drop_pending_updates: true });
  if (!res.ok) {
    fail(`Webhook o'chirilmadi: ${res.description}`);
  }
  console.log("✅ Webhook o'chirildi (endi long-polling ishlatish mumkin).");
}

// 7-qadam: guruhlar bo'yicha jonli hisobot — a'zolar soni, botning admin
// holati va kirdi/chiqdi tozalash ishlashi. Guruhlar ro'yxati bazadan o'qiladi
// (DATABASE_URL bo'lmasa qadam o'tkazib yuboriladi).
async function groupReport(me, problems) {
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    console.log("ℹ️  7. DATABASE_URL yo'q — guruhlar hisoboti o'tkazildi");
    return;
  }

  let rows = [];
  try {
    const { Client } = await import("pg");
    const isLocal = /(localhost|127\.0\.0\.1|::1)/.test(url);
    const client = new Client({
      connectionString: url,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    const res = await client.query(
      "select chat_id, title, member_count, clean_join_leave, active " +
        "from groups order by active desc, title",
    );
    rows = res.rows;
    await client.end();
  } catch (err) {
    console.log(
      `⚠️  7. Guruhlar ro'yxatini o'qib bo'lmadi: ${
        err instanceof Error ? err.message : err
      }`,
    );
    console.log("   (Jadval hali yaratilmagan bo'lsa: npm run db:push)\n");
    return;
  }

  if (rows.length === 0) {
    console.log("ℹ️  7. Bazada hali guruh yo'q — botni guruhga qo'shing.\n");
    return;
  }

  console.log(`📋 7. Guruhlar hisoboti (${rows.length} ta):`);
  let totalMembers = 0;
  let adminOk = 0;

  for (const g of rows) {
    const chatId = Number(g.chat_id);
    const flags = g.active ? [] : ["nofaol"];

    // A'zolar soni — to'g'ridan-to'g'ri Telegram'dan
    const count = await tg("getChatMemberCount", { chat_id: chatId });
    const members = count.ok ? Number(count.result) : null;
    if (members !== null) totalMembers += members;

    // Botning o'zi guruhda adminmi?
    const member = await tg("getChatMember", {
      chat_id: chatId,
      user_id: me.result.id,
    });
    const status = member.ok ? member.result.status : null;
    const isAdmin = status === "administrator" || status === "creator";
    const canDelete =
      status === "creator" ||
      (isAdmin && member.result?.can_delete_messages === true);
    if (isAdmin) adminOk++;

    const adminText = !member.ok
      ? "bot guruhda topilmadi"
      : isAdmin
        ? canDelete
          ? "admin ✓ (xabar o'chirish ✓)"
          : "admin, lekin xabar o'chirish huquqi yo'q ✗"
        : "admin EMAS ✗";

    const cleanText = !g.clean_join_leave
      ? "tozalash o'chirilgan (web panel → 🧹 belgilang)"
      : canDelete
        ? "kirdi/chiqdi tozalanadi ✓"
        : "kirdi/chiqdi tozalanmaydi ✗";

    console.log(
      `   • ${g.title} (${chatId})${flags.length ? ` [${flags.join(", ")}]` : ""}`,
    );
    console.log(
      `     👥 a'zolar: ${members ?? "?"}  ·  🛡 ${adminText}`,
    );
    console.log(`     🧹 ${cleanText}`);

    if (
      members !== null &&
      g.member_count !== null &&
      Number(g.member_count) !== members
    ) {
      console.log(
        `     ↻ bazada ${g.member_count} yozilgan — web paneldagi\n` +
          `       "🔄 A'zolar sonini yangilash" tugmasini bosing`,
      );
    }

    if (!member.ok) {
      problems.push(
        `"${g.title}" guruhida bot topilmadi — botni guruhga qo'shing.`,
      );
    } else if (g.active && g.clean_join_leave && !canDelete) {
      problems.push(
        `"${g.title}" guruhida kirdi/chiqdi xabarlari tozalanmaydi.\n` +
          "   Botni guruhda ADMIN qiling va \"Xabarlarni o'chirish\" huquqini bering.",
      );
    }
  }

  console.log(
    `   ── jami 👥 ${totalMembers} a'zo · bot admin: ${adminOk}/${rows.length}\n`,
  );
}

// To'liq diagnostika: token → bot → ilova manzili → secret → webhook holati
async function doctor() {
  const problems = [];
  console.log("\n🔍 Diagnostika boshlandi...\n");

  // 1) Token va bot
  const me = await tg("getMe");
  if (!me.ok) {
    fail(
      `Token tekshirilmadi: ${me.description}\n` +
        "   Telegram shu holatda 404 Not Found ham qaytarishi mumkin —\n" +
        "   token @BotFather'dagidek, < > belgilarisiz bo'lishi kerak.",
    );
  }
  console.log(`✅ 1. Token ishlaydi: @${me.result.username} (${me.result.first_name})`);

  // 2) Ilova manzili
  const base = toBaseUrl(process.env.SITE_URL || "");
  if (!base) {
    problems.push("SITE_URL o'rnatilmagan — webhook manzilini tekshirib bo'lmadi.");
  } else {
    const endpoint = `${base}/api/telegram/webhook`;
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(20_000) });
      const text = (await res.text()).slice(0, 200);
      if (res.ok && text.includes('"ok":true')) {
        console.log(`✅ 2. Ilova javob beradi: ${endpoint} (${res.status})`);
      } else {
        problems.push(
          `Ilova ${endpoint} da kutilgan javobni bermadi (http ${res.status}): ${text}`,
        );
        console.log(`❌ 2. Ilova manzili: ${endpoint} → http ${res.status}`);
      }
    } catch (err) {
      problems.push(
        `Ilovaga ulanib bo'lmadi (${base}): ${
          err instanceof Error ? err.message : "network error"
        }`,
      );
      console.log(`❌ 2. Ilovaga ulanib bo'lmadi: ${base}`);
    }

    // 3) Baza va jadvallar holati (/api/health)
    try {
      const health = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(20_000),
      });
      const hb = await health.json().catch(() => ({}));
      if (hb.ok && hb.check === "db+tables") {
        console.log("✅ 3. Baza ulangan va barcha jadvallar mavjud");
      } else if (hb.check !== "db+tables") {
        problems.push(
          "Deploy eski versiyada — jadvallarni tekshirib bo'lmadi.\n" +
            "   Health tekshiruvi yangilangan kod bilan qayta deploy qiling:\n" +
            "   git push  (yoki Vercel → Deployments → Redeploy)",
        );
        console.log("⚠️  3. Health javobi eski versiyadan — jadval tekshiruvi o'tkazildi");
      } else if (hb.reason === "tables_missing") {
        problems.push(
          `Baza ulangan, lekin jadvallar yo'q: ${(hb.missing || []).join(", ")}\n` +
            `   Tuzatish: DATABASE_URL="postgresql://..." npm run db:push`,
        );
        console.log("❌ 3. Jadvallar yaratilmagan — bot jim qoladi");
      } else if (hb.reason === "schema_outdated") {
        problems.push(
          `Baza jadvallari bor, lekin ustunlar eski: ${(hb.missingColumns || []).join(", ")}\n` +
            `   Tuzatish: DATABASE_URL="postgresql://..." npm run db:push`,
        );
        console.log("❌ 3. Sxema eski — yangi ustunlar (a'zolar soni) qo'shilmagan");
      } else {
        problems.push(
          `Baza tekshiruvi muvaffaqiyatsiz (${health.status}): ${hb.reason || ""} ${
            hb.detail || ""
          }`,
        );
        console.log(`❌ 3. Baza: ${hb.reason || "xato"} (http ${health.status})`);
      }
    } catch {
      problems.push("Baza tekshiruvida tarmoq xatosi (/api/health).");
    }

    // 4) Secret mosligini tekshirish (bo'sh update — bazaga yozilmaydi)
    const secret = sanitize(process.env.TELEGRAM_WEBHOOK_SECRET || "");
    if (secret) {
      try {
        const withSecret = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-bot-api-secret-token": secret,
          },
          body: JSON.stringify({ update_id: 0 }),
          signal: AbortSignal.timeout(20_000),
        });
        if (withSecret.status === 200) {
          console.log("✅ 4. Secret token ilovada to'g'ri (200)");
        } else if (withSecret.status === 403) {
          problems.push(
            "TELEGRAM_WEBHOOK_SECRET ilovadagidan farq qiladi (403).\n" +
              "   Vercel'dagi Environment Variable bilan bir xil bo'lishi kerak.",
          );
          console.log("❌ 4. Secret token mos kelmadi (403)");
        } else {
          problems.push(`Secret tekshiruvi kutilmagan javob: ${withSecret.status}`);
          console.log(`⚠️  4. Secret tekshiruvi: http ${withSecret.status}`);
        }
      } catch {
        problems.push("Secret tekshiruvida tarmoq xatosi.");
      }
    } else {
      console.log("ℹ️  4. TELEGRAM_WEBHOOK_SECRET yo'q (ixtiyoriy, lekin tavsiya etiladi)");
    }

    // 5) Webhook holati
    const info = await tg("getWebhookInfo");
    const webhook = info.result || {};
    const expected = `${base}/api/telegram/webhook`;
    if (webhook.url === expected) {
      console.log(`✅ 5. Webhook to'g'ri o'rnatilgan: ${webhook.url}`);
    } else if (!webhook.url) {
      problems.push(
        `Webhook o'rnatilmagan. Tuzatish: npm run telegram:set -- --url ${base}`,
      );
      console.log("❌ 5. Webhook o'rnatilmagan");
    } else {
      problems.push(
        `Webhook boshqa manzilga qarayapti: ${webhook.url}\n` +
          `   Kutilgan: ${expected}\n` +
          `   Tuzatish: npm run telegram:set -- --url ${base}`,
      );
      console.log(`❌ 5. Webhook manzili boshqa: ${webhook.url}`);
    }
    if (webhook.last_error_message) {
      problems.push(
        `Telegram oxirgi xatosi: ${webhook.last_error_message} ` +
          `(pending: ${webhook.pending_update_count ?? 0})`,
      );
    }
  }

  // 6) Guruh xabarlarini ko'rish huquqi
  if (me.result.can_read_all_group_messages === false) {
    console.log(
      "⚠️  6. Group Privacy YOQILGAN — bot guruhdagi oddiy xabarlarni ko'rmaydi.",
    );
    console.log(
      "   Yechim: botni guruhda ADMIN qiling YOKI @BotFather → /mybots → bot →\n" +
        "   Bot Settings → Group Privacy → Turn off.",
    );
  } else {
    console.log("✅ 6. Bot guruh xabarlarini ko'ra oladi (privacy off)");
  }

  // 6.5) AI yozuvchi (ixtiyoriy) — agent matnni LLM yozadimi yoki shablonmi
  const geminiLike =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const aiKey =
    process.env.AI_API_KEY || process.env.OPENAI_API_KEY || geminiLike;
  if (aiKey) {
    const provider = process.env.AI_API_KEY || process.env.OPENAI_API_KEY
      ? "openai-mos"
      : "gemini";
    const model =
      process.env.AI_MODEL || (provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini");
    console.log(`🤖 AI yozuvchi: ${provider} (${model}) — matnni LLM yozadi`);
  } else {
    console.log(
      "ℹ️  AI kaliti yo'q — shablon orqali matn yoziladi (AI_API_KEY / GEMINI_API_KEY ixtiyoriy)",
    );
  }

  // 7) Guruhlar: a'zolar soni, bot admin holati, kirdi/chiqdi tozalash ishlashi
  await groupReport(me, problems);

  console.log("");
  if (problems.length === 0) {
    console.log("🎉 Hammasi joyida! Endi botga shaxsiy chatda /start yozing.\n");
    return;
  }
  console.log("❗ Topilgan muammolar:\n");
  problems.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
  console.log("");
}

const actions = {
  info: showInfo,
  set: setWebhook,
  delete: deleteWebhook,
  doctor,
};

const run = actions[action];
if (!run) {
  fail(`Noma'lum buyruq: "${action}". Foydalanish: doctor | info | set | delete`);
}

try {
  await run();
} catch (err) {
  fail(err instanceof Error ? err.message : "Noma'lum xatolik");
}
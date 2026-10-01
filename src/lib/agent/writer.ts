// Post matnini yozuvchi ("copywriter") modul.
//
// Provayderdan mustaqil: OpenAI-mos API (OpenAI, Groq, OpenRouter, lokal
// Ollama...) yoki Google Gemini. Hech qanday kalit sozlanmagan bo'lsa —
// shablon (template) asosida matn yig'adi, ya'ni funksiya baribir ishlaydi.
//
// Tashqi kutubxona ishlatilmaydi: repo'ning qolgan qismi kabi faqat `fetch`.

import type { AgentCategory, AgentLength } from "./types";

const TIMEOUT_MS = 25_000;
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

export type AiProvider = {
  kind: "openai" | "gemini";
  apiKey: string;
  model: string;
  baseUrl: string;
};

/**
 * Sozlamalardan provayderni aniqlaydi.
 *   1) AI_API_KEY (+ ixtiyoriy AI_BASE_URL / AI_MODEL) — OpenAI-mos
 *   2) OPENAI_API_KEY                                  — OpenAI
 *   3) GEMINI_API_KEY yoki GOOGLE_API_KEY              — Gemini
 */
export function resolveProvider(): AiProvider | null {
  const env = (name: string) => (process.env[name] || "").trim();

  const openaiKey = env("AI_API_KEY") || env("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      kind: "openai",
      apiKey: openaiKey,
      model: env("AI_MODEL") || DEFAULT_OPENAI_MODEL,
      baseUrl: (env("AI_BASE_URL") || "https://api.openai.com/v1").replace(
        /\/+$/,
        "",
      ),
    };
  }

  const geminiKey = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY");
  if (geminiKey) {
    return {
      kind: "gemini",
      apiKey: geminiKey,
      model: env("AI_MODEL") || DEFAULT_GEMINI_MODEL,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    };
  }

  return null;
}

export type AiStatus =
  | { configured: true; provider: string; model: string; baseUrl: string }
  | { configured: false; provider: null; model: null; baseUrl: null };

export function aiStatus(): AiStatus {
  const p = resolveProvider();
  if (!p)
    return { configured: false, provider: null, model: null, baseUrl: null };
  return {
    configured: true,
    provider: p.kind,
    model: p.model,
    baseUrl: p.baseUrl,
  };
}

export type WriteInput = {
  brief: string;
  category: "agro" | "ferma" | "boshqa" | null;
  length: AgentLength | null;
  link: string | null;
  extra: string | null;
  groupTitles: string[];
  // 0 = birinchi variant, >0 = qayta yozish (boshqacha ifoda so'raymiz)
  variant: number;
  // Rasm (postdagi foto) — LLM tahlil qilishi uchun base64 ko'rinishida.
  // null bo'lsa — faqat matn bilan ishlaymiz.
  image?: { base64: string; mime: string } | null;
};

export type WriteResult = {
  text: string;
  // "openai" | "gemini" | "template"
  provider: string;
  // LLM xato berib shablonga tushib qolgan bo'lsa true
  fellBack: boolean;
  // LLM yozgan KATEGORIYA belgisi (avtomatik rejimda guruh tanlash uchun);
  // shablon/placeholder javobda null.
  category: AgentCategory | null;
};

// Export qilinadi: o'qitish namunalari aynan shu system prompt bilan yig'iladi
// (dialogs.ts / generatePost), ya'ni training va inference bir xil bo'ladi.
export const SYSTEM_PROMPT = [
  "Sen O'zbekiston qishloq xo'jaligi va chorvachilik bozori uchun professional",
  "kontent muallifi (copywriter)san. Matnni Telegram guruhlariga post sifatida",
  "yozasan.",
  "",
  "QAT'IY QOIDALAR:",
  "1. Faqat o'zbek tilida (lotin alifbosida) yoz. Rus/ingliz tilida yozma.",
  "2. Faqat foydalanuvchi bergan ma'lumotdan foydalan. Narx, telefon raqam,",
  "   manzil, kafolat, muddat, tajriba yillari kabi faktlarni O'YLAB TOPMA.",
  "   Ma'lumot berilmagan bo'lsa umuman yozma.",
  "3. Birinchi satr — qisqa sarlavha (5-10 so'z, emoji bilan bo'lishi mumkin).",
  "   Keyingi qatorlar — asosiy matn.",
  "4. Reklama shiori emas: aniq, sodda, foydali va ishonchli uslubda yoz.",
  "   Keraksiz maqtov, 'eng zo'r', '100% kafolat' kabi so'zlardan qoch.",
  "5. Emojini me'yorida ishlat (butun matnda 1-3 ta, har satrda emas).",
  "6. Hashtag yozma — tizim uni guruh yo'nalishi bo'yicha o'zi qo'shadi.",
  "7. HTML/Markdown belgilarini ishlatma (**, #, `, <b> ...). Faqat oddiy matn.",
  "8. Havola berilgan bo'lsa, uni matnning eng oxirida alohida satrda keltir.",
  "9. Ortiqcha bo'sh satr qoldirma, oxirida savol-javob bloki yozma.",
  "",
  "UZUNLIK:",
  "• short  — 3-5 qisqa satr, faqat asosiy mazmun.",
  "• medium — 6-10 satr, bitta sarlavha + 2-3 fikr/afzallik.",
  "• long   — 12-18 satr, sarlavha + tuzilgan ro'yxat (•) + xulosa satri.",
  "",
  "RASM (agar berilgan bo'lsa):",
  "• Rasmni tahlil qil: unda nima ko'rsatilgan (ekin, chorva, mahsulot,",
  "  texnika...) va matnni shunga moslab yoz. Rasm ko'rsatmagan narx,",
  "  telefon, manzil, kafolat kabi ma'lumotlarni o'ylab topma.",
  "",
  "MAVZU:",
  "• Qisqa mavzu berilgan bo'lsa — uni to'liq postga aylantir: birinchi satr",
  "  sarlavha, keyin mazmunli matn (tanlangan uzunlikda). Berilmagan",
  "  faktlarni qo'shma — faqat mavzudagi ma'lumotdan foydalan.",
  "",
  "KATEGORIYA (majburiy):",
  "• Matnning ENG OXIRIDA alohida bitta satrda bittasini yoz:",
  "  KATEGORIYA: agro — dehqonchilik/ekin/o'g'it/urug'/sug'orish haqida bo'lsa",
  "  KATEGORIYA: ferma — chorvachilik/parranda/ozuqa/veterinariya haqida bo'lsa",
  "  KATEGORIYA: boshqa — ham agrogа, ham fermaga tegishli yoki aniq emas bo'lsa",
  "• Bu satrni matnning boshqa qismiga qo'shma — faqat eng oxirida, mustaqil",
  "  satri bo'lib tursin. Boshqa hech qanday iz qoldirma.",
].join("\n");

function lengthHint(length: AgentLength | null): string {
  switch (length) {
    case "short":
      return "short — juda qisqa va lo'nda (3-5 satr)";
    case "long":
      return "long — batafsil, tuzilgan ro'yxat bilan (12-18 satr)";
    default:
      return "medium — o'rtacha uzunlik (6-10 satr)";
  }
}

// Export qilinadi: dialog yozilganda (flow.ts) foydalanuvchi xabari shu
// prompt bilan qayta yig'iladi — train/inference mosligi uchun.
export function buildUserPrompt(input: WriteInput): string {
  const lines: string[] = [];
  lines.push(
    `Mavzu / qisqa tavsif: ${input.brief || "(berilmagan — o'zing mantiqan yoz)"}`,
  );
  if (input.category) {
    lines.push(
      `Yo'nalish: ${
        input.category === "ferma"
          ? "ferma va chorvachilik"
          : input.category === "agro"
            ? "agro dehqonchilik"
            : "umumiy / boshqa"
      }`,
    );
  } else {
    // Avtomatik rejim: yo'nalishni model o'zi tanlaydi (mavzu va rasm bo'yicha)
    lines.push(
      "Yo'nalish: o'zing tanla — mavzu va rasmga eng mosini tanlab, oxirida KATEGORIYA qatorini yoz.",
    );
  }
  lines.push(`Uslub va uzunlik: ${lengthHint(input.length)}`);
  if (input.link) lines.push(`Qo'shiladigan havola: ${input.link}`);
  if (input.extra)
    lines.push(`Foydalanuvchi bergan qo'shimcha ma'lumot: ${input.extra}`);
  if (input.image)
    lines.push(
      "Rasm ilova qilingan — uni tahlil qil va matnni rasmga moslab yoz.",
    );
  if (input.groupTitles.length > 0) {
    lines.push(`Post qaysi guruhlarga ketadi: ${input.groupTitles.join(", ")}`);
  }
  if (input.variant > 0) {
    lines.push(
      "Avvalgi variantni takrorlama — xuddi shu mazmunni boshqacha so'zlar va boshqa sarlavha bilan yoz.",
    );
  }
  lines.push("Endi post matnini yoz.");
  return lines.filter(Boolean).join("\n");
}

// ─── LLM chaqiruvlari ────────────────────────────────────────────────────

async function callOpenAiCompatible(
  provider: AiProvider,
  system: string,
  user: string,
  image: { base64: string; mime: string } | null = null,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            // Rasm bo'lsa — content bo'limlardan iborat bo'ladi (vision)
            content: image
              ? [
                  { type: "text", text: user },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${image.mime};base64,${image.base64}`,
                    },
                  },
                ]
              : user,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error("AI (openai-mos) xato:", res.status, detail);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch (err) {
    console.error(
      "AI (openai-mos) xato:",
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(
  provider: AiProvider,
  system: string,
  user: string,
  image: { base64: string; mime: string } | null = null,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      `${provider.baseUrl}/models/${encodeURIComponent(provider.model)}` +
      `:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        // Rasm bo'lsa — inline_data sifatida matnga biriktiriladi (vision)
        contents: [
          {
            role: "user",
            parts: image
              ? [
                  { text: user },
                  {
                    inline_data: { mime_type: image.mime, data: image.base64 },
                  },
                ]
              : [{ text: user }],
          },
        ],
        generationConfig: { temperature: 0.7 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error("AI (gemini) xato:", res.status, detail);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("AI (gemini) xato:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Tozalash ────────────────────────────────────────────────────────────

/**
 * Model ba'zan qoidalarga bo'ysunmaydi: markdown, HTML teg, hashtag
 * qo'shib yuboradi. Ularni olib tashlaymiz — Telegram'da <b> faqat
 * formatter orqali qo'yiladi (aks holda foydalanuvchi teg ko'radi).
 */
export function sanitizePost(raw: string): string {
  return raw
    .replace(/```[a-zA-Z]*\n?/g, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    // faqat hashtag'dan iborat qatorlarni olib tashlaymiz
    .replace(/^[ \t]*(?:#[\p{L}\d_]+[ \t]*)+$/gmu, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CATEGORY_MARKER_RE = /^\s*KATEGORIYA\s*:\s*(agro|ferma|boshqa)\s*$/i;

/**
 * LLM yozgan `KATEGORIYA: agro|ferma|boshqa` belgisini matndan ajratadi.
 * Post o'ziga kerak emas (hashtag tizim tomonidan qo'shiladi) — faqat qaysi
 * yo'nalish va mos guruhlarga ketishini aniqlash uchun ishlatiladi.
 */
export function splitCategoryMarker(text: string): {
  text: string;
  category: AgentCategory | null;
} {
  let category: AgentCategory | null = null;
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    const m = CATEGORY_MARKER_RE.exec(line);
    if (m) {
      category = m[1].toLowerCase() as AgentCategory;
      continue;
    }
    kept.push(line);
  }
  return {
    text: kept
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    category,
  };
}

/**
 * Birinchi qisqa satrni sarlavha (title) qilib ajratamiz — `formatPost`
 * uni <b>...</b> qilib chiqaradi, post shunda chiroyli ko'rinadi.
 */
export function splitTitleBody(text: string): { title: string; body: string } {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return { title: "", body: "" };

  const first = lines[i].replace(/^\*{0,2}(.+?)\*{0,2}$/, "$1").trim();
  const rest = lines.slice(i + 1).join("\n").trim();
  if (rest && first.length > 0 && first.length <= 80 && !first.endsWith(":")) {
    return { title: first, body: rest };
  }
  return { title: "", body: text.trim() };
}

// ─── Targ'ibot (CTA) posti ──────────────────────────────────────────────
//
// Botning o'zini reklama qiluvchi aniq matni. Brend qayta yozilmasligi
// uchun LLM chaqirilmaydi — brief kalit so'zlarga mos kelsa (masalan
// "targ'ibot", "chaqiriq", "@agrozai_bot") shablon sifatida qaytariladi.
const PROMO_BRIEF_RE =
  /(targ['ʻ]?ibot|promo|chaqiriq|agrozai_bot|agroz_auth)/iu;

function promoPost(input: WriteInput): string {
  const lines = [
    "🌱 Dehqonlar va Bog'bonlar diqqatiga!",
    "",
    "Ekiningiz bargi sarg'ayib, quriydimi yoki zararkunanda tushdimi?",
    "Bargni rasmga olib @agrozai_bot ga yuboring — sun'iy intellekt 3 soniyada",
    "tashxis qo'yib, qanday dori sepishni hisoblab beradi.",
    "",
    "🌿 Agronomlar va O'g'it/Urug' do'konlari egalari!",
    "",
    "O'z do'koningiz va xizmatlaringizni tizimga qo'shib, hududingizdagi",
    "dehqonlardan buyurtma oling: @agroz_auth_bot",
  ];
  const link = input.link?.trim();
  if (link) {
    lines.push("", `🔗 ${link}`);
  }
  return lines.join("\n");
}

export function isPromoBrief(brief: string): boolean {
  return PROMO_BRIEF_RE.test((brief || "").trim());
}

// ─── Kalit yo'q bo'lganda: shablon ───────────────────────────────────────

function categoryIntro(category: WriteInput["category"]): string {
  switch (category) {
    case "ferma":
      return "🐄 Ferma va chorvachilik bo'yicha foydali ma'lumot.";
    case "agro":
      return "🌾 Agro dehqonchilik bo'yicha foydali ma'lumot.";
    default:
      return "ℹ️ Foydali ma'lumot.";
  }
}

/**
 * AI kaliti sozlanmagan (yoki LLM xato bergan) holatda ishlatiladigan
 * zaxira generator: mavzu + javoblardan toza, tartibli matn yig'adi.
 * Hech narsa o'ylab topmaydi — faqat foydalanuvchi bergan matnni joylaydi.
 */
export function templatePost(input: WriteInput): string {
  if (isPromoBrief(input.brief)) return promoPost(input);

  const brief = input.brief.trim();
  const parts: string[] = [];

  if (brief) {
    const { title, body } = splitTitleBody(brief);
    if (title) {
      parts.push(title);
      if (body) parts.push(body);
    } else {
      parts.push(brief);
    }
  } else {
    parts.push("📌 Yangi e'lon");
  }

  const extra = input.extra?.trim();
  if (extra) parts.push(extra);
  parts.push(categoryIntro(input.category));
  if (input.link) parts.push(`🔗 ${input.link}`);

  return sanitizePost(parts.join("\n\n"));
}

// ─── Asosiy funksiya ─────────────────────────────────────────────────────

export async function writePost(input: WriteInput): Promise<WriteResult> {
  // Aniq CTA matni (targ'ibot/poster) — LLM qayta yozmasligi uchun
  // avval shablonni tekshiramiz.
  if (isPromoBrief(input.brief)) {
    return {
      text: promoPost(input),
      provider: "template",
      fellBack: false,
      category: null,
    };
  }

  const provider = resolveProvider();
  if (!provider) {
    return {
      text: templatePost(input),
      provider: "template",
      fellBack: false,
      category: null,
    };
  }

  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(input);
  let raw =
    provider.kind === "gemini"
      ? await callGemini(provider, system, user, input.image ?? null)
      : await callOpenAiCompatible(provider, system, user, input.image ?? null);

  // Model rasmni qo'llab-quvvatlamasa (yoki rasm yuzasidan xato bersa) —
  // rasmsiz, faqat mavzu bilan yana bir marta urinamiz.
  if (!raw && input.image) {
    const retryUser = buildUserPrompt({ ...input, image: null });
    raw =
      provider.kind === "gemini"
        ? await callGemini(provider, system, retryUser)
        : await callOpenAiCompatible(provider, system, retryUser);
  }

  if (!raw) {
    return {
      text: templatePost(input),
      provider: "template",
      fellBack: true,
      category: null,
    };
  }

  const { text, category } = splitCategoryMarker(sanitizePost(raw));
  if (!text) {
    return {
      text: templatePost(input),
      provider: "template",
      fellBack: true,
      category,
    };
  }
  return { text, provider: provider.kind, fellBack: false, category };
}
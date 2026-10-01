// Rasm orqali ekin kasalligi / zararkunandasi tashxisi (vision).
//
// Google Gemini (inline_data) yoki OpenAI-mos (image_url) providerlari bilan
// ishlaydi — AI_API_KEY / GEMINI_API_KEY dan birortasi sozlangan bo'lsa.
// Kalit sozlanmagan bo'lsa null qaytaradi (webhook foydalanuvchini ogohlantiradi).
//
// Javob toza matn sifatida qaytariladi: sanitizePost markdown/HTML'ni tozalaydi,
// webhook esa escapeHtml bilan yuboradi.

import { resolveProvider, sanitizePost, type AiProvider } from "./writer";

const TIMEOUT_MS = 45_000;

const DIAGNOSE_SYSTEM = [
  "Sen O'zbekiston sharoitidagi tajribali agronom-san. Foydalanuvchi",
  "yuborgan o'simlik rasmiga qarab kasallik yoki zararkunandani aniqlaysan.",
  "",
  "QAT'IY QOIDALAR:",
  "1. Faqat o'zbek tilida (lotin alifbosida) yoz.",
  "2. Birinchi qatorda aniq TASHXIS ber — taxmin bo'lsa \"ehtimol\" deb belgila.",
  "3. Davolash uchun FAQAT O'zbekiston bozorida sotiladigan dorilarni yoz",
  "   (masalan: Ridomil Gold, Entoxi, Consento, Amistart Super — fungitsid;",
  "   Bi-58, Koragen, Kalipso, Boreyi — insektitsid). Chet eldagi nomlar",
  "   kerak emas.",
  "4. Har bir dori uchun aniq doza (100 litr suvga necha ml/g), purkash",
  "   muddati va qayta purkash oralig'ini ko'rsat.",
  "5. Qisqa formatda yoz:",
  "   🔍 TASHXIS: ...",
  "   🧪 Sabab: ...",
  "   💊 Davolash: 1) ... 2) ...",
  "   🛡 Profilaktika: ...",
  "6. Rasm aniq bo'lmasa, qaysi qismini yaqindan suratga olishni so'ra.",
  "7. Oxirida bitta eslatma: dori ishlatishdan oldin etiketkani o'qib",
  "   chiqing va mahalliy mutaxassis tasdig'ini oling.",
].join("\n");

export type DiagnoseResult = {
  text: string;
  // "openai" | "gemini"
  provider: string;
};

function noteOr(text?: string): string {
  const clean = (text || "").trim();
  return clean
    ? `Foydalanuvchi izohi: ${clean}\nRasmni tahlil qilib tashxis qo'y.`
    : "Rasmni tahlil qilib tashxis qo'y.";
}

export async function diagnoseImage(params: {
  buffer: Buffer;
  mime: string;
  note?: string;
}): Promise<DiagnoseResult | null> {
  const provider = resolveProvider();
  if (!provider) return null;

  const b64 = params.buffer.toString("base64");
  const raw =
    provider.kind === "gemini"
      ? await callGeminiVision(provider, b64, params.mime, params.note)
      : await callOpenAiVision(provider, b64, params.mime, params.note);
  if (!raw) return null;

  const text = sanitizePost(raw);
  return text ? { text, provider: provider.kind } : null;
}

async function callOpenAiVision(
  provider: AiProvider,
  b64: string,
  mime: string,
  note?: string,
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
        temperature: 0.3,
        max_tokens: 700,
        messages: [
          { role: "system", content: DIAGNOSE_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: noteOr(note) },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${b64}` },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error("Diagnosis (openai-mos) xato:", res.status, detail);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch (err) {
    console.error(
      "Diagnosis (openai-mos) xato:",
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiVision(
  provider: AiProvider,
  b64: string,
  mime: string,
  note?: string,
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
        systemInstruction: { parts: [{ text: DIAGNOSE_SYSTEM }] },
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mime, data: b64 } },
              { text: noteOr(note) },
            ],
          },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error("Diagnosis (gemini) xato:", res.status, detail);
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
    console.error(
      "Diagnosis (gemini) xato:",
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
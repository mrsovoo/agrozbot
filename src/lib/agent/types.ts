// Bot "agent" suhbatining holati.
// `bot_drafts.session` (jsonb) ustunida saqlanadi — shu sababli bu faylda
// HECH QANDAY import bo'lmasligi kerak (schema.ts faqat tipni oladi).

export type AgentCategory = "agro" | "ferma" | "boshqa";
export type AgentLength = "short" | "medium" | "long";

export type AgentAnswers = {
  category: AgentCategory | null;
  length: AgentLength | null;
  needLink: boolean | null;
  link: string | null;
  extra: string | null;
};

// Suhbat bosqichlari:
//   awaiting_brief — mavzu (post nima haqida) kutilmoqda
//   questions      — savollarga javob (inline tugma) kutilmoqda
//   awaiting_link  — havola matni kutilmoqda
//   awaiting_extra — qo'shimcha ma'lumot (narx, aloqa...) kutilmoqda
//   editing        — tayyor matnning yangi variantini kutyapmiz
//   ready          — matn tayyor, preview ko'rsatilgan
export type AgentStage =
  | "awaiting_brief"
  | "questions"
  | "awaiting_link"
  | "awaiting_extra"
  | "editing"
  | "ready";

export type AgentSession = {
  stage: AgentStage;
  // Nechanchi savol (0..AGENT_STEP_COUNT)
  step: number;
  // Foydalanuvchi bergan mavzu/qisqa tavsif (rasm izohi yoki matn)
  brief: string;
  answers: AgentAnswers;
  // Yakuniy matn (LLM yoki shablon)
  text: string | null;
  // Nechа marta qayta yozilgani (variatsiya uchun)
  tries: number;
};

// Savollar tartibi
export const AGENT_STEP_COUNT = 4;

export function defaultAnswers(): AgentAnswers {
  return {
    category: null,
    length: null,
    needLink: null,
    link: null,
    extra: null,
  };
}

export function newSession(brief: string): AgentSession {
  const clean = brief.trim();
  return {
    stage: clean ? "questions" : "awaiting_brief",
    step: 0,
    brief: clean,
    answers: defaultAnswers(),
    text: null,
    tries: 0,
  };
}

// Eski (agentdan oldingi) draftlarni ham ishlatish uchun: session bo'lmasa,
// mavjud `text` ni tayyor matn sifatida qabul qilamiz.
export function legacySession(brief: string | null): AgentSession {
  const text = (brief || "").trim();
  return {
    stage: "ready",
    step: AGENT_STEP_COUNT,
    brief: text,
    answers: defaultAnswers(),
    text: text || null,
    tries: 0,
  };
}

// Mavzu matnidan yo'nalishni aniqlash (kalit so'zlar bo'yicha)
const CATEGORY_HINTS: [AgentCategory, RegExp][] = [
  [
    "ferma",
    /(ferma|chorva|qoramol|mol\b|sigir|buzoq|qo'y|qozi|echki|parranda|tovuq|jo'ja|juja|baliq|asalari|asal|ozuqa|yem\b|sut|go'sht|gosht|tuxum|jun|teri)/i,
  ],
  [
    "agro",
    /(agro|dehqon|ekin|urug'|urug|bog'|bog\b|sabzavot|meva|poliz|paxta|g'alla|galla|don\b|o'g'it|ogit|traktor|kombayn|issiqxona|ko'chat|kochat|sug'orish|sugorish|hosil)/i,
  ],
];

export function detectCategoryFromText(text: string): AgentCategory | null {
  for (const [cat, re] of CATEGORY_HINTS) {
    if (re.test(text)) return cat;
  }
  return null;
}

export function categoryLabelUz(category: AgentCategory | null): string {
  switch (category) {
    case "agro":
      return "🌾 Agro dehqonchilik";
    case "ferma":
      return "🐄 Ferma va chorvachilik";
    case "boshqa":
      return "📋 Boshqa / umumiy";
    default:
      return "🤖 Avtomatik";
  }
}

export function lengthLabelUz(length: AgentLength | null): string {
  switch (length) {
    case "short":
      return "⚡ Qisqa";
    case "long":
      return "📚 Batafsil";
    default:
      return "⚖️ O'rtacha";
  }
}

// Foydalanuvchi yuborgan matn havolaga o'xshaydimi?
export function looksLikeLink(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  return /^(https?:\/\/|t\.me\/|www\.|@[\w\d_]{3,})/i.test(t) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t);
}

export function normalizeLink(text: string): string {
  const t = text.trim().replace(/[.,;]+$/, "");
  if (/^@[\w\d_]+$/.test(t)) return `https://t.me/${t.slice(1)}`;
  if (/^t\.me\//i.test(t)) return `https://${t}`;
  if (/^www\./i.test(t)) return `https://${t}`;
  return t;
}
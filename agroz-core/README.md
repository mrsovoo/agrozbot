# agroz-core — Agroz AI Q&A boti (Python / aiogram 3)

Foydalanuvchi savollari uchun **alohida bot** (`@agrozai_bot` kabi):
matnli savollar **Meta Llama 3.3 (Groq)** da, rasmli tashxislar
**Google Gemini (vision)** da javoblanadi.

> ⚠️ Bu loyiha repo ildizidagi TypeScript agrozbot (post tarqatish + admin
> panel) bilan **bir xil token ishlatmaydi** — `.env` dagi `BOT_TOKEN`
> butunlay boshqa botniki bo'lishi kerak.

## Struktura

```text
agroz-core/
├── .env              # kalitlar (gitga chiqmaydi)
├── .env.example      # shablon
├── requirements.txt
├── prompts.py        # SYSTEM_PROMPT — O'zbekiston bozoriga mos tizim buyrug'i
├── ai_router.py      # matn → Groq (Llama), rasm → Gemini
├── dataset.py        # har bir suhbat → messages.jsonl (fine-tuning uchun)
└── bot.py            # aiogram 3 handler'lari
```

## O'rnatish va ishga tushirish

```bash
cd agroz-core
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env      # kalitlarni to'ldiring
python bot.py
```

## `.env` kalitlari

| Kalit | Qayerdan olinadi |
|---|---|
| `BOT_TOKEN` | @BotFather (bu bot TS agrozbot'dan AYRIDA) |
| `GROQ_API_KEY` | [groq.com](https://console.groq.com) — bepul, Meta Llama uchun |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) — rasmli tashxis uchun |
| `ADMIN_IDS` | Vergul bilan ID'lar — faqat ular uchun `/post` |
| `DATASET_PATH` | ixiyoriy, bo'sh qolsa `agroz-core/messages.jsonl` |

## Behavior xususiyatlari

- **Kalit bo'sh bo'lsa bot yiqilmaydi** — foydalanuvchiga "kalit sozlanmagan"
  degan xabar ketadi.
- **Event loop bloklanmaydi** — sinxron Groq/Gemini chaqiruvlari
  `asyncio.to_thread` ichida.
- **4096 belgi chegarasi** — uzun tahlillar bo'laklab yuboriladi (HTML escape
  har bo'lakka alohida qo'llanadi).
- **`messages.jsonl`** — user/assistant har yozuv, manba (`text`/`image`) va
  model nomi bilan yoziladi; fine-tuning xomashyosi. Fayl gitga kirmaydi.
- **Ekotizim tugmalari** — har bir javob ostida `@agroz_auth_bot` va
  AgrozGO ilova tugmalari.

## Keyingi qadamlar

1. Panel botdagi (TypeScript) `/panel` → **AI savol-javob** bo'limiga
   backend sifatida shu ``ai_router.py`` ni ulash (yoki uni TypeScript'ga
   ko'chirish) — ikkala bot bitta xotira o'rtasida ishlaydi.
2. `messages.jsonl` yig'ilgach — Groq/Gemini'da fine-tuning yoki RAG.

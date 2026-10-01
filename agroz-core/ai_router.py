"""AI router — matnli savollar uchun Meta Llama (Groq), rasmli savollar
uchun Google Gemini (vision).

Dizayn qoidalari:
- Mijozlar LOADINGDA yaratiladi: kalit bo'sh bo'lsa ham modul import
  bo'ladi, xato faqat chaqirilganda ``AiError`` ko'rinishida chiqadi va
  bot yiqilmaydi.
- Groq/Gemini kutubxonalari sinxron — ``asyncio.to_thread`` orqali
  ishlaymiz, shu bilan aiogram event loop'i bloklanmaydi.
"""

import asyncio
import os

from dotenv import load_dotenv

from prompts import SYSTEM_PROMPT

load_dotenv()

GROQ_MODEL = "llama-3.3-70b-versatile"
GEMINI_MODEL = "gemini-2.5-flash"


class AiError(Exception):
    """Foydalanuvchiga ko'rsatadigan AI xatosi (kalit yo'q, tarmoq, model)."""


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


# ── Meta Llama (Groq) ────────────────────────────────────────────────────


def _groq_sync(user_text: str) -> str:
    from groq import Groq  # kerak bo'lganda import qilinadi

    key = _env("GROQ_API_KEY")
    if not key:
        raise AiError(
            "GROQ_API_KEY sozlanmagan — matnli tahlil ishlamaydi "
            "(groq.com dan bepul kalit oling)."
        )
    client = Groq(api_key=key)
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
        temperature=0.2,
        max_tokens=1024,
    )
    return (completion.choices[0].message.content or "").strip()


async def query_meta_llama(user_text: str) -> str:
    """Matnli savolni Meta Llama 3.3 (Groq) orqali tahlil qilish."""
    try:
        answer = await asyncio.to_thread(_groq_sync, user_text)
    except AiError:
        raise
    except Exception as err:  # noqa: BLE001
        raise AiError(f"Matnli tahlilda xatolik: {err}") from err
    if not answer:
        raise AiError("Model bo'sh javob qaytardi — qayta urinib ko'ring.")
    return answer


# ── Google Gemini (vision) ───────────────────────────────────────────────


def _gemini_sync(image_bytes: bytes, caption: str, mime_type: str) -> str:
    from google import genai
    from google.genai import types

    key = _env("GEMINI_API_KEY")
    if not key:
        raise AiError(
            "GEMINI_API_KEY sozlanmagan — rasmli tashxis ishlamaydi "
            "(aistudio.google.com dan kalit oling)."
        )
    client = genai.Client(api_key=key)
    prompt = (caption or "").strip() or (
        "Ushbu rasmga agro-veterinar yoki agronomik tashxis qo'ying "
        "va yechim bering."
    )
    # SYSTEM_PROMPT rasm bilan birga yuboriladi — shunda tashxis ham
    # O'zbekiston bozori dorilariga mos bo'ladi.
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            f"{SYSTEM_PROMPT}\n\nFoydalanuvchi izohi: {prompt}",
        ],
    )
    return (getattr(response, "text", None) or "").strip()


async def query_gemini_vision(
    image_bytes: bytes,
    caption: str = "",
    mime_type: str = "image/jpeg",
) -> str:
    """Rasmli savolni Google Gemini (vision) orqali tahlil qilish."""
    try:
        answer = await asyncio.to_thread(
            _gemini_sync, image_bytes, caption, mime_type
        )
    except AiError:
        raise
    except Exception as err:  # noqa: BLE001
        raise AiError(f"Rasmli tashxisda xatolik: {err}") from err
    if not answer:
        raise AiError("Model rasm uchun bo'sh javob qaytardi.")
    return answer

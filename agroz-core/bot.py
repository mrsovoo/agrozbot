"""Agroz AI — Telegram bot (aiogram 3).

Tartib (ro'yxatdan o'tish tartib muhim):
  /start        → boshlang'ich xabar + ekotizim tugmalari
  /post (admin) → poster paneli (placeholder)
  rasm          → Google Gemini vision (tashxis)
  matn          → Meta Llama 3.3 / Groq (agro-savol javobi)
"""

from __future__ import annotations

import asyncio
import html
import io
import os
from typing import Any, Dict, Optional

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message
from dotenv import load_dotenv

from ai_router import AiError, query_gemini_vision, query_meta_llama
from dataset import record_message

load_dotenv()

BOT_TOKEN = (os.getenv("BOT_TOKEN") or "").strip()
if not BOT_TOKEN:
    raise SystemExit("BOT_TOKEN .env faylida kiritilmagan.")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

ADMIN_IDS = {
    int(part)
    for part in (os.getenv("ADMIN_IDS") or "").replace(";", ",").split(",")
    if part.strip().isdigit()
}


# ── Yordamchilar ─────────────────────────────────────────────────────────


def get_ecosystem_keyboard() -> InlineKeyboardMarkup:
    """Agroz ekotizimi tugmalari — har bir javob bilan yuboriladi."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="👨‍⚕️ Mutaxassis/Dorixonalar (Auth)",
                    url="https://t.me/agroz_auth_bot",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🌱 AgrozGO Ilovasi",
                    url="https://t.me/agrozai_bot/app",
                )
            ],
        ]
    )


def user_dict(user: Optional[Any]) -> Dict[str, Any]:
    if user is None:
        return {}
    return {
        "id": getattr(user, "id", None),
        "username": getattr(user, "username", None),
        "first_name": getattr(user, "first_name", None),
    }


async def _safe_delete(message: Optional[Message]) -> None:
    """Status xabarni o'chiradi (allaqachon o'chirilgan bo'lsa — jim o'tadi)."""
    if message is None:
        return
    try:
        await message.delete()
    except Exception:  # noqa: BLE001
        pass


async def reply_long(message: Message, text: str) -> None:
    """Javobni escape qilib, 4096 belgi chegarasiga moslab yuboradi.

    Avval xom matn bo'laklarga kesiladi, so'ng HAR bo'lak alohida
    escape qilinadi — shu bilan ``&lt;`` kabi belgilar bo'lak orasida
    yorilib qolmaydi.
    """
    raw = (text or "").strip() or "⚠️ Bo'sh javob qaytdi."
    limit = 4000  # HTML escape dan keyin oshmasligi uchun ozgina kamaytiramiz
    start = 0
    while start < len(raw):
        chunk = html.escape(raw[start : start + limit])
        markup = get_ecosystem_keyboard() if start == 0 else None
        await message.reply(chunk, parse_mode="HTML", reply_markup=markup)
        start += limit


async def reply_error(message: Message, err: Exception) -> None:
    await message.reply(
        f"⚠️ {html.escape(str(err))}",
        parse_mode="HTML",
        reply_markup=get_ecosystem_keyboard(),
    )


# ── Handler'lar ──────────────────────────────────────────────────────────


@router.message(CommandStart())
async def start_handler(message: Message) -> None:
    await message.reply(
        "Assalomu alaykum! Men <b>Agroz AI</b> — agro-veterinariya va "
        "agronomiya yordamchisiman.\n\n"
        "• Chorva yoki ekin muammosini <b>matn</b> qilib yozing — "
        "Meta Llama tahlil qiladi.\n"
        "• Kasallik alomatlari, qurt yoki barg <b>rasmini</b> yuboring — "
        "Gemini ko'rib chiqadi.\n\n"
        "Tillar: o'zbekcha (lotin/kirill), tojikcha va xalqona shevalar.",
        parse_mode="HTML",
        reply_markup=get_ecosystem_keyboard(),
    )


@router.message(F.from_user.id.in_(ADMIN_IDS), F.text.startswith("/post"))
async def admin_poster_handler(message: Message) -> None:
    # Poster tarqatish logikasi shu yerga ulanadi:
    # guruh ID'lari ro'yxati + bot.sendPhoto() tsikli (aiohttp bilan).
    # Hozircha TypeScript agrozbot'dagi panel buni bajaradi.
    await message.reply(
        "📮 Post guruhlarga yuborish uchun tayyorlandi! ✅",
        reply_markup=get_ecosystem_keyboard(),
    )


@router.message(F.photo)
async def handle_photo_diagnosis(message: Message) -> None:
    """Rasm → Google Gemini vision (tashxis)."""
    status = await message.reply("🔍 Rasm tahlil qilinmoqda, iltimos kuting...")
    user = user_dict(message.from_user)
    try:
        photo = message.photo[-1]
        file = await bot.get_file(photo.file_id)
        buffer = io.BytesIO()
        await bot.download(file, destination=buffer)
        image_data = buffer.getvalue()

        caption = (message.caption or "").strip()
        answer = await query_gemini_vision(image_data, caption)

        record_message(user, "user", f"[RASM] {caption}".strip(), source="image")
        record_message(
            user, "assistant", answer, source="image", model="gemini-2.5-flash"
        )

        await _safe_delete(status)
        await reply_long(message, answer)
    except AiError as err:
        await _safe_delete(status)
        await reply_error(message, err)
    except Exception as err:  # noqa: BLE001
        await _safe_delete(status)
        print(f"[bot] rasmli tashxis xatosi: {err}")
        await message.reply(
            "⚠️ Kutilmagan xatolik yuz berdi. Keyinroq urinib ko'ring.",
            reply_markup=get_ecosystem_keyboard(),
        )


@router.message(F.text)
async def handle_text_question(message: Message) -> None:
    """Matn → Meta Llama 3.3 (Groq) — oddiy foydalanuvchi savoli."""
    text = (message.text or "").strip()
    if not text:
        return
    if text.startswith("/"):
        await message.reply(
            "🤔 Noma'lum buyruq. Boshlash uchun /start bosing.",
            reply_markup=get_ecosystem_keyboard(),
        )
        return

    status = await message.reply("⏳ Javob tayyorlanmoqda...")
    user = user_dict(message.from_user)
    try:
        answer = await query_meta_llama(text)

        record_message(user, "user", text, source="text")
        record_message(
            user,
            "assistant",
            answer,
            source="text",
            model="llama-3.3-70b-versatile",
        )

        await _safe_delete(status)
        await reply_long(message, answer)
    except AiError as err:
        await _safe_delete(status)
        await reply_error(message, err)
    except Exception as err:  # noqa: BLE001
        await _safe_delete(status)
        print(f"[bot] matnli javob xatosi: {err}")
        await message.reply(
            "⚠️ Kutilmagan xatolik yuz berdi. Keyinroq urinib ko'ring.",
            reply_markup=get_ecosystem_keyboard(),
        )


async def main() -> None:
    print("Agroz AI Bot (Meta Llama + Gemini) ishga tushdi...")
    await dp.start_polling(bot, allowed_updates=["message"])


if __name__ == "__main__":
    asyncio.run(main())

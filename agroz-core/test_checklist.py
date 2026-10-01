"""Avtomatik nazorat — real foydalanuvchiga ochishdan oldin 4 ta ssenariy.

    cd agroz-core
    .venv/bin/python test_checklist.py

Telegram orqali qo'lda (live) testlar uchun: ``TESTLAR.md``.

Testlar TARMOQSIZ ishlaydi: Groq/Gemini o'rniga sut (mock) funksiyalar,
Telegram o'rniga FakeBot/FakeMessage, JSONL o'rniga vaqtinchalik fayl.
"""

import asyncio
import json
import os
import tempfile
import unittest

from aiogram import F
from aiogram.types import Chat, Message, PhotoSize, User

import bot as botmod
import dataset as datasetmod
from ai_router import AiError, _to_ai_error
from prompts import SYSTEM_PROMPT

REAL_IMAGE = b"\xff\xd8\xff\xe0FAKEJPEGDATA" * 10
CHAT = Chat.model_construct(id=555, type="private")


class FakeStatus:
    def __init__(self):
        self.deleted = False

    async def delete(self):
        self.deleted = True


class FakeMessage:
    """aiogram Message o'rniga — barcha reply/delete yozuvlarini yig'adi."""

    def __init__(self, text=None, photo=None, caption=None, user_id=222):
        self.text = text
        self.caption = caption
        self.photo = photo or []
        self.from_user = type(
            "FakeUser",
            (),
            {"id": user_id, "username": "farmer", "first_name": "Test"},
        )()
        self.replies = []

    async def reply(self, text, parse_mode=None, reply_markup=None):
        status = FakeStatus()
        self.replies.append(
            {
                "text": text,
                "parse_mode": parse_mode,
                "keyboard": reply_markup,
                "status": status,
            }
        )
        return status


class FakeBot:
    """bot.get_file / bot.download ni Telegram o'rniga simulyatsiya qiladi."""

    def __init__(self, image_bytes=REAL_IMAGE):
        self.image_bytes = image_bytes
        self.seen_file_ids = []

    async def get_file(self, file_id):
        self.seen_file_ids.append(file_id)
        return object()

    async def download(self, file, destination=None, **kwargs):
        destination.write(self.image_bytes)


def make_real_message(text=None, user_id=111):
    """Magic-filter (admin ajratish) uchun haqiqiy aiogram Message."""
    return Message.model_construct(
        message_id=1,
        date=None,
        chat=CHAT,
        from_user=User.model_construct(
            id=user_id, is_bot=False, first_name="Test", username="tester"
        ),
        text=text,
        caption=None,
        photo=None,
    )


def keyboard_urls(reply):
    return [b.url for row in reply["keyboard"].inline_keyboard for b in row]


class Checklist(unittest.TestCase):
    def setUp(self):
        # JSONL → vaqtinchalik fayl (asosiy datasetga zarar bermaslik uchun)
        handle = tempfile.NamedTemporaryFile(delete=False, suffix=".jsonl")
        handle.close()
        os.unlink(handle.name)
        self.tmp_path = handle.name
        self.old_path = datasetmod.DATASET_PATH
        datasetmod.DATASET_PATH = self.tmp_path

        # Bot global'larini saqlash / tiklash
        self.old = {
            "bot": botmod.bot,
            "text_ai": botmod.query_meta_llama,
            "vision_ai": botmod.query_gemini_vision,
            "admins": botmod.ADMIN_IDS,
        }
        botmod.bot = FakeBot()

    def tearDown(self):
        botmod.bot = self.old["bot"]
        botmod.query_meta_llama = self.old["text_ai"]
        botmod.query_gemini_vision = self.old["vision_ai"]
        botmod.ADMIN_IDS = self.old["admins"]
        datasetmod.DATASET_PATH = self.old_path
        if os.path.exists(self.tmp_path):
            os.unlink(self.tmp_path)

    def dataset_rows(self):
        if not os.path.exists(self.tmp_path):
            return []
        with open(self.tmp_path, encoding="utf-8") as fh:
            return [json.loads(line) for line in fh if line.strip()]

    # ── Test 1: Admin ajratilishi ─────────────────────────────────────

    def test_1_admin_filter_separation(self):
        botmod.ADMIN_IDS = {111}
        expr = F.from_user.id.in_(botmod.ADMIN_IDS) & F.text.startswith("/post")
        # Admin — filtr o'tadi; oddiy user — o'tmaydi; ADMIN_IDS bo'sh — hech kim admin emas
        self.assertTrue(expr.resolve(make_real_message("/post Salom", user_id=111)))
        self.assertFalse(expr.resolve(make_real_message("/post Salom", user_id=999)))
        self.assertFalse(
            (F.from_user.id.in_(set()) & F.text.startswith("/post")).resolve(
                make_real_message("/post Salom", user_id=111)
            )
        )

    def test_1_admin_poster_reply(self):
        msg = FakeMessage(text="/post Salom guruh", user_id=111)
        asyncio.run(botmod.admin_poster_handler(msg))
        self.assertIn("tayyorlandi", msg.replies[0]["text"])

    def test_1_non_admin_post_not_distribution(self):
        # Oddiy user /post yuborsa — "Noma'lum buyruq" oladi, tarqatish
        # oqimiga KIRMAYDI (poster ham, AI javob ham yuborilmaydi)
        msg = FakeMessage(text="/post Salom guruh")
        asyncio.run(botmod.handle_text_question(msg))
        self.assertEqual(len(msg.replies), 1)
        self.assertIn("Noma'lum buyruq", msg.replies[0]["text"])
        self.assertEqual(self.dataset_rows(), [])

    # ── Test 2: Meta AI (matn / shevalar) ─────────────────────────────

    def test_2_text_flow_disclaimer_keyboard_dataset(self):
        captured = {}

        async def fake_llama(text):
            captured["text"] = text
            return (
                "Kunjara normasi hisoblandi. <b>Diqqat</b>!\n"
                "📌 Muhim eslatma: Agroz AI tahlili. Amaliyotdan oldin "
                "mutaxassis bilan maslahatlashing."
            )

        botmod.query_meta_llama = fake_llama
        msg = FakeMessage(
            text="250 kg buqaga kuniga 2 kg kunjara, 4 kg kepak berayapman"
        )
        asyncio.run(botmod.handle_text_question(msg))

        self.assertIn("250 kg buqaga", captured["text"])
        status, answer = msg.replies[0], msg.replies[1]
        self.assertTrue(status["status"].deleted)  # "Javob tayyorlanmoqda" o'chdi
        self.assertIn("📌 Muhim eslatma", answer["text"])
        self.assertEqual(answer["parse_mode"], "HTML")
        # HTML escape — model javobidagi teg xavfsiz matnga aylantiriladi
        self.assertIn("&lt;b&gt;Diqqat&lt;/b&gt;", answer["text"])
        urls = keyboard_urls(answer)
        self.assertIn("https://t.me/agroz_auth_bot", urls)
        self.assertIn("https://t.me/agrozai_bot/app", urls)
        # Dataset: user + assistant juftligi
        rows = self.dataset_rows()
        self.assertEqual([r["role"] for r in rows], ["user", "assistant"])
        self.assertEqual(rows[1]["model"], "llama-3.3-70b-versatile")
        self.assertEqual(rows[1]["source"], "text")

    def test_2_missing_groq_key_friendly_error(self):
        if (os.getenv("GROQ_API_KEY") or "").strip():
            self.skipTest("GROQ_API_KEY to'ldirilgan — tarmoq testini qo'lda boring")
        msg = FakeMessage(text="salom")
        asyncio.run(botmod.handle_text_question(msg))  # real query_meta_llama
        self.assertEqual(len(msg.replies), 2)
        error = msg.replies[1]["text"]
        self.assertTrue(error.startswith("⚠️"))
        self.assertIn("GROQ_API_KEY", error)
        self.assertIsNotNone(msg.replies[1]["keyboard"])  # tugmalar bor

    # ── Test 3: Google Gemini (vision) ────────────────────────────────

    def test_3_photo_bytes_reach_vision(self):
        captured = {}

        async def fake_vision(image_bytes, caption="", mime_type="image/jpeg"):
            captured["bytes"] = image_bytes
            captured["caption"] = caption
            captured["mime"] = mime_type
            return "Fitoftora. Ridomil Gold 2.5 g / 10 l suvga purkang."

        botmod.query_gemini_vision = fake_vision
        photo = PhotoSize.model_construct(
            file_id="PHOTO_123", file_unique_id="U123", width=90, height=60
        )
        msg = FakeMessage(photo=[photo], caption="barg sariq")
        asyncio.run(botmod.handle_photo_diagnosis(msg))

        # bot.download orqali baytlar TO'LIQ Gemini'ga o'tgan
        self.assertEqual(captured["bytes"], REAL_IMAGE)
        self.assertEqual(captured["caption"], "barg sariq")
        self.assertEqual(captured["mime"], "image/jpeg")
        self.assertEqual(botmod.bot.seen_file_ids, ["PHOTO_123"])

        status, answer = msg.replies[0], msg.replies[1]
        self.assertTrue(status["status"].deleted)
        self.assertIn("Ridomil Gold", answer["text"])
        urls = keyboard_urls(answer)
        self.assertIn("https://t.me/agroz_auth_bot", urls)
        rows = self.dataset_rows()
        self.assertEqual([r["source"] for r in rows], ["image", "image"])
        self.assertEqual(rows[1]["model"], "gemini-2.5-flash")

    def test_3_missing_gemini_key_friendly_error(self):
        if (os.getenv("GEMINI_API_KEY") or "").strip():
            self.skipTest("GEMINI_API_KEY to'ldirilgan — tarmoq testini qo'lda boring")
        photo = PhotoSize.model_construct(
            file_id="P2", file_unique_id="U2", width=90, height=60
        )
        msg = FakeMessage(photo=[photo])
        asyncio.run(botmod.handle_photo_diagnosis(msg))  # real query_gemini_vision
        self.assertEqual(len(msg.replies), 2)
        error = msg.replies[1]["text"]
        self.assertTrue(error.startswith("⚠️"))
        self.assertIn("GEMINI_API_KEY", error)

    # ── Test 4: Ekotizim zanjiri (Auth + Mini App) ────────────────────

    def test_4_start_menu_keyboard(self):
        msg = FakeMessage(text="/start")
        asyncio.run(botmod.start_handler(msg))
        answer = msg.replies[0]
        self.assertEqual(answer["parse_mode"], "HTML")
        urls = keyboard_urls(answer)
        self.assertEqual(len(urls), 2)
        self.assertIn("https://t.me/agroz_auth_bot", urls)
        self.assertIn("https://t.me/agrozai_bot/app", urls)

    def test_4_keyboard_in_every_reply_and_error(self):
        # Muvaffaqiyatli javobda ham, xatolik javobida ham tugmalar bor
        async def fake_llama(text):
            return "Javob."

        async def boom(text):
            raise AiError("sinov xatosi")

        for fake in (fake_llama, boom):
            botmod.query_meta_llama = fake
            msg = FakeMessage(text="savol")
            asyncio.run(botmod.handle_text_question(msg))
            answer = msg.replies[1]
            urls = keyboard_urls(answer)
            self.assertIn("https://t.me/agroz_auth_bot", urls)
            self.assertIn("https://t.me/agrozai_bot/app", urls)

    # ── Qo'shimcha nazorat (prompt, bo'laklash, logger, 429) ──────────

    def test_prompt_disclaimer_and_local_medicines(self):
        self.assertIn("📌 Muhim eslatma", SYSTEM_PROMPT)
        self.assertIn("Ridomil Gold", SYSTEM_PROMPT)  # agro
        self.assertIn("Nitoks", SYSTEM_PROMPT)  # veterinariya
        self.assertIn("tojikcha", SYSTEM_PROMPT)  # tillar

    def test_reply_long_splits_at_4096(self):
        msg = FakeMessage()
        asyncio.run(botmod.reply_long(msg, "A" * 9000))
        self.assertEqual(len(msg.replies), 3)
        self.assertIsNotNone(msg.replies[0]["keyboard"])  # klaviatura 1-bolakda
        self.assertIsNone(msg.replies[1]["keyboard"])
        self.assertTrue(all(r["parse_mode"] == "HTML" for r in msg.replies))

    def test_dataset_logger_swallows_io_errors(self):
        old = datasetmod.DATASET_PATH
        try:
            datasetmod.DATASET_PATH = "/nonexistent_agroz_dir/x.jsonl"
            # Hech qanday istisno tashlamasligi kerak (bot to'xtamasligi kerak)
            datasetmod.record_message({"id": 1}, "user", "test", source="text")
        finally:
            datasetmod.DATASET_PATH = old

    def test_rate_limit_429_friendly(self):
        err = type("RateLimitError", (Exception,), {"status_code": 429})("limit")
        friendly = _to_ai_error(err, "Matnli tahlilda")
        self.assertIsInstance(friendly, AiError)
        self.assertIn("429", str(friendly))
        # Oddiy xato ham AiError bo'lib qoladi
        generic = _to_ai_error(ValueError("bad key"), "Matnli tahlilda")
        self.assertIsInstance(generic, AiError)
        self.assertIn("bad key", str(generic))


if __name__ == "__main__":
    unittest.main(verbosity=2)


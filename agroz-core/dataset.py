"""Har bir suhbatni ``messages.jsonl`` fayliga yozadi — fine-tuning xomashyosi.

Bir qator = bitta yozuv (JSONL):

    {"ts": "...", "user_id": 123, "username": "...", "role": "user",
     "source": "text", "model": null, "content": "..."}

Qoidalar (TypeScript agrozbot'dagi ``recordDialog`` bilan bir xil):
- Yozish HECH QACHON botni to'xtatmaydi — xato faqat console'ga chiqadi;
- JSONL formati keyin to'g'ridan-to'g'ri o'qitishga ketadi;
- Rasmli suhbatlarda user yozuvi ``[RASM] <caption>`` ko'rinishida.
"""

import json
import os
import threading
import time
from typing import Any, Dict, Optional

_LOCK = threading.Lock()

DATASET_PATH = (os.getenv("DATASET_PATH") or "").strip() or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "messages.jsonl"
)


def record_message(
    user: Optional[Dict[str, Any]],
    role: str,
    content: str,
    source: str = "text",
    model: Optional[str] = None,
) -> None:
    """Bitta yozuvni messages.jsonl ga qo'shadi (xatolik yutib yuboriladi)."""
    text = (content or "").strip()
    if not text:
        return
    user = user or {}
    row = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "user_id": user.get("id"),
        "username": user.get("username"),
        "first_name": user.get("first_name"),
        "role": role,
        "source": source,
        "model": model,
        "content": text,
    }
    try:
        with _LOCK:
            with open(DATASET_PATH, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception as err:  # noqa: BLE001
        print(f"[dataset] yozib bo'lmadi: {err}")

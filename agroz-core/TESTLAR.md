# TESTLAR — real foydalanuvchiga ochishdan oldingi nazorat ro'yxati

Tizim shu tartibda tekshiriladi. **1-bosqich avtomatik** (terminalda),
**2-bosqich Telegram orqali qo'lda**. Ikkalasi ham o'tgach botni
`ferma.max` kabi guruhlarga ochish mumkin.

## 0-bosqich. Avtomatik testlar (tarmoqsiz)

```bash
cd agroz-core
.venv/bin/python test_checklist.py
```

Kutilgan natija: **`OK`** (testlar soni ko'rsatiladi, FAILED bo'lmasin).
Bu testlar admin filtri, matn/rasm oqimini, JSONL yozuvini, klaviaturani,
HTML escape, 4096 bo'laklash va 429 do'stini o'rab oladi.

## 1-bosqich. Botni ishga tushirish

```bash
cd agroz-core
source .venv/bin/activate
python bot.py
```

Terminal **ochiq qoldirilsin** — barcha loglar shu yerda
(`Agroz AI Bot ... ishga tushdi`, `[bot] ...` xatolar, `[dataset] ...`).

## 2-bosqich. Telegram orqali 4 ta ssenariy

### Test 1: Admin ajratilishi

| | |
|---|---|
| **Harakat** | Admin akkaunt: `/post Salom guruh`. Keyin oddiy akkaunt: xuddi shu matn. |
| **Muvaffaqiyat mezoni** | Admin → «Post guruhlarga yuborish uchun tayyorlandi! ✅». Oddiy user → **«🤔 Noma'lum buyruq»** (AI javobi ham, tarqatish ham YO'Q). |
| **Avtomatik qisman** | `test_1_*` — filtr, admin javobi, non-admin oqimi. |

> Eslatma: `/post` hozircha **placeholder** — haqiqiy guruhlarga tarqatish
> TypeScript paneldan (`@agrozbot` / web panel) bajariladi. Python botdan
> tarqatish kerak bo'lsa — `admin_poster_handler` ichiga guruh ID'lari
> ro'yxati + `sendPhoto` tsikli qo'shiladi.

### Test 2: Meta AI (matn va shevalar)

| | |
|---|---|
| **Harakat** | 1) *«Орди чермака метияам орди гандум кунчора метияам хамаш пухта теяам дурунаш бирафсас»* 2) *«250 kg buqaga kuniga 2 kg kunjara, 4 kg kepak berayapman, yana nima qo'shay?»* |
| **Muvaffaqiyat mezoni** | Javob **1-3 soniyada**, foydalanuvchi tilda (tojik/sheva → shevada); ratsion hisobida atsidoz xavfi va tuzatish yo'llari; javob oxirida **📌 Muhim eslatma**; ostida 2 ta tugma (`@agroz_auth_bot`, AgrozGO). |
| **Tekshiruv** | `tail -n 2 messages.jsonl` → `role: user` va `role: assistant`, `model: llama-3.3-70b-versatile`. |

> 📌 tegi **model javobida** bo'lishi kerak (u `prompts.py` dagi tizim
> buyrug'ida). Agar kelmasa — model buyruqni bajarmadi, `SYSTEM_PROMPT`
> qayta ko'rib chiqilsin.

### Test 3: Google Gemini (vizual tashxis)

| | |
|---|---|
| **Harakat** | 1) Barg sarg'ayishi/fitoftora rasmi (izoh: *«pomidor bargi»*). 2) Parranda yoki mol kasallik belgisi rasmi. |
| **Muvaffaqiyat mezoni** | Avval «🔍 Rasm tahlil qilinmoqda...» → 3-8 soniyada kasallik/zararkunanda **nomlanadi** va O'zbekistonda mavjud preparat (**Ridomil Gold, Bi-58, Baykoks** ...) **suvga nisbatan** ko'rsatiladi; keyin status xabar o'chadi. |
| **Tekshiruv** | `tail -n 2 messages.jsonl` → `source: image`, `model: gemini-2.5-flash`. |

> Telegram rasmlarni siqib yuboradi — bu Gemini uchun muhim emas
> (JPEG baytlar `bot.download` orqali to'liq o'tadi; tekshiruvi `test_3_`
> da avtomatik).

### Test 4: Ekotizim zanjiri (Auth + Mini App)

| | |
|---|---|
| **Harakat** | Javob ostidagi «👨‍⚕️ Mutaxassis/Dorixonalar (Auth)» va «🌱 AgrozGO Ilovasi» tugmalarini bosish. |
| **Muvaffaqiyat mezoni** | Birinchi bosishda `https://t.me/agroz_auth_bot` ochiladi (AgrozAuth botga o'tish); ikkinchisida — AgrozGO Mini App (`/app` havolasi). Tugmalar **har bir** javobda, xatolik javoblarida ham bor. |

## Monitoring (test paytida terminalga qarang)

| Xato | Nima qilish |
|---|---|
| **429 / rate limit** | Endi xom xato emas, do'storni chiqadi: *«limit oshdi (429) — 10-15 soniyadan keyin qayta urinib ko'ring»*. Ko'p uchsa `GROQ_API_KEY`/`GEMINI_API_KEY` limitini tekshiring. |
| **Rasm o'tmadi** | Terminalda `[bot] rasmli tashxis xatosi: ...` bo'lmasa kerak — baytlar to'liq o'tdi (test_3 avtomatik kafolatlaydi). |
| **Baza yozuvi** | Har muvaffaqiyatli testdan keyin: `wc -l messages.jsonl` (2 qator oshganini tekshiring), `tail -f messages.jsonl` — yozuv real vaqtda ko'rinadi. |
| **Bot yiqildi** | `python bot.py` traceback bo'lmasin; kalitlar bo'sh bo'lsa ham bot ishlaydi (faqat javobda ⚠️ chiqadi). |

## Oxirgi yig'ish (go-live) buyrug'i

```bash
.venv/bin/python test_checklist.py    # → OK
wc -l messages.jsonl                  # → testlardan keyin qatorlar bor
```

Ikkalasi ham musbat bo'lgach — botni «Agroz AI» nomi ostida guruhlarga
taqdim etish mumkin.

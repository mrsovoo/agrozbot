# 🚀 Vercelga joylash yo'riqnomasi

## 0-qadam. Muhit o'zgaruvchilari (.env)

Lokalda ishlatish uchun shablonni nusxalang va to'ldiring:

```bash
cp .env.example .env
```

`.env` fayli `.gitignore` da — u GitHubga chiqmaydi. Vercel'da esa bu
o'zgaruvchilar **Project → Settings → Environment Variables** bo'limiga
kiritiladi (4-qadamga qarang).

| Nomi | Qiymati |
|---|---|
| `DATABASE_URL` | Neon connection string (`?sslmode=require` bilan) |
| `TELEGRAM_BOT_TOKEN` | @BotFather tokeni (`123456789:AA...`) |
| `ADMIN_PASSWORD` | O'zingizning kuchli parolingiz |
| `SITE_URL` | Saytning ommaviy manzili, masalan `https://agrozbot.vercel.app` |
| `TELEGRAM_WEBHOOK_SECRET` | ixtiyoriy, masalan `agro_ferma_2026_secret` |
| `BOT_ADMIN_IDS` | ixtiyoriy, Telegram ID'ingiz (vergul bilan) |
| `AI_API_KEY` | ixtiyoriy. OpenAI-mos kalit (OpenAI/OpenRouter/Groq) — post matni LLM yozadi |
| `AI_BASE_URL` | ixtiyoriy. OpenAI-mos base URL (default `https://api.openai.com/v1`) |
| `AI_MODEL` | ixtiyoriy. Default `gpt-4o-mini` (Gemini uchun `gemini-2.0-flash`) |
| `GEMINI_API_KEY` | ixtiyoriy. Google Gemini kaliti (`GOOGLE_API_KEY` ham ishlaydi) |

> AI kalitlari **butunlay ixtiyoriy**: bo'sh qolsa bot matnni ichki shablon
> asosida yozadi va suhbat o'zgarmasdan davom etadi.

## 1-qadam. Bazani tayyorlash (bepul — Neon)

1. https://neon.tech ga kiring → **Sign up** (GitHub orqali).
2. **Create project** → region: `Frankfurt (eu-central-1)` (O'zbekistonga yaqin).
3. **Connection string** ni nusxalang. U shunga o'xshaydi:
   ```
   postgresql://neondb_owner:XXXX@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

> Muqobil: Vercel ichida **Storage → Create Database → Neon** — `DATABASE_URL` avtomatik qo'shiladi.

## 2-qadam. Jadvallarni bazaga yuborish

Kompyuteringizda loyiha papkasida:

```bash
npm install
DATABASE_URL="postgresql://...sizning-neon-url..." npx drizzle-kit push --config=drizzle.prod.config.ts
```

Qisqaroq variant (paketdagi skript orqali):

```bash
DATABASE_URL="postgresql://...sizning-neon-url..." npm run db:push
```

Windows PowerShell'da:
```powershell
$env:DATABASE_URL="postgresql://..."; npx drizzle-kit push --config=drizzle.prod.config.ts
```

`[✓] Changes applied` chiqsa — tayyor.

> 🔁 **Kod yangilangach qayta bajarish kerak.** Sxemaga yangi ustun qo'shilsa
> (masalan `groups.member_count`, `groups.bot_is_admin`, `groups.bot_can_delete`,
> `bot_drafts.session` — agent suhbatining holati),
> `db:push` ni yana bajaring — aks holda `/api/health`
> `503 {"reason":"schema_outdated"}` qaytaradi va guruhlar sahifasi xato beradi.

## 3-qadam. Kodni GitHubga yuklash

```bash
git init
git add .
git commit -m "Agro Ferma bot"
git branch -M main
git remote add origin https://github.com/SIZNING-USERNAME/agro-ferma-bot.git
git push -u origin main
```

> `.env` fayli `.gitignore` da — maxfiy kalitlar GitHubga chiqmaydi.

## 4-qadam. Vercelga ulash

1. https://vercel.com → **Add New → Project** → GitHub reponi tanlang → **Import**.
2. Framework: **Next.js** (avtomatik aniqlanadi). Boshqa narsani o'zgartirmang.
3. **Environment Variables** bo'limiga qo'shing (0-qadamdagi jadval):

| Nomi | Qiymati |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `TELEGRAM_BOT_TOKEN` | @BotFather tokeni |
| `ADMIN_PASSWORD` | O'zingizning kuchli parolingiz |
| `SITE_URL` | `https://loyiha-nomi.vercel.app` (webhook shu domenga o'rnatiladi) |
| `TELEGRAM_WEBHOOK_SECRET` | ixtiyoriy, masalan `agro_ferma_2026_secret` |
| `BOT_ADMIN_IDS` | ixtiyoriy, Telegram ID'ingiz |

> `DATABASE_URL` Vercel'da **build paytida ham** mavjud bo'lishi tavsiya etiladi,
> lekin kod endi unga bog'liq emas: baza ulanishi faqat birinchi so'rovda
> yaratiladi (`src/db/index.ts`), shuning uchun build baribir o'tadi.

4. **Deploy** tugmasini bosing. 1–2 daqiqada `https://loyiha-nomi.vercel.app` tayyor bo'ladi.

## 5-qadam. Botni ulash (webhook)

**A yo'l — paneldan (oson):**

1. `https://loyiha-nomi.vercel.app` ga kiring → parol bilan kiring.
2. **⚙️ Sozlamalar** → manzil avtomatik to'ldiriladi (`SITE_URL` dan) → **O'rnatish**.
3. "✅ Webhook o'rnatildi" chiqadi.

**B yo'l — terminaldan (bir buyruq):**

```bash
# .env (yoki Vercel'dagi qiymatlar) bilan: TELEGRAM_BOT_TOKEN, SITE_URL, TELEGRAM_WEBHOOK_SECRET
npm run telegram:doctor                   # TO'LIQ diagnostika (avval shuni ishlating)
npm run telegram:set                      # SITE_URL dan foydalanadi
npm run telegram:set -- --url https://agrozbot.vercel.app
npm run telegram:info                     # bot, webhook holati va xatolarni ko'rish
npm run telegram:delete                   # webhook'ni o'chirish
```

> ⚠️ **api.telegram.org manzilini qo'lda yozmang.** Telegram'ga yuboriladigan
> manzil faqat shunday bo'ladi: `https://agrozbot.vercel.app/api/telegram/webhook`.
> Hujjatlardagi `<token>` / `<domen>` kabi burchakli qavslar va `/api/webhook`
> kabi noto'g'ri yo'l **404 Not Found** ga olib keladi. Skript bunday
> kiritmalarni avtomatik tozalaydi, lekin eng osoni — yuqoridagi buyruqlardan
> foydalanish.

Muvaffaqiyatli javob:

```
✅ Webhook o'rnatildi: https://agrozbot.vercel.app/api/telegram/webhook
🤖 Bot: @sizning_botingiz
🔗 Webhook: https://agrozbot.vercel.app/api/telegram/webhook
```

> Webhook'ni faqat HTTPS manzilga o'rnatish mumkin — Telegram HTTP qabul qilmaydi.

## 6-qadam. Guruhlarga qo'shish

1. Botni **Agro dehqonchilik** va **Ferma va chorvachilik** guruhlariga qo'shing.
2. Botni **admin** qiling (kamida *Xabarlarni o'chirish* huquqi bilan).
3. Guruhda istalgan xabar yozilsa yoki bot qo'shilganda — guruh panelda paydo
   bo'ladi, **a'zolar soni** (👥) va **botning admin holati** (🛡) ham yozib olinadi.
4. Botga shaxsiy chatda `/start` yozing → birinchi yozgan odam admin bo'ladi.

### Guruh kartasidagi belgilar

| Belgi | Ma'nosi |
|---|---|
| `👥 152 a'zo` | `getChatMemberCount` natijasi (bazada saqlanadi) |
| `🛡 Bot admin (o'chirish ✓)` | Bot admin va *Xabarlarni o'chirish* huquqi bor → kirdi/chiqdi tozalanadi |
| `🛡 Bot admin (o'chirish ✗)` | Admin, lekin o'chirish huquqi yo'q → tozalanmaydi |
| `⚠️ Bot admin emas` | `deleteMessage` ishlamaydi → kirdi/chiqdi tozalanmaydi |
| `↻ 01.10 14:20` | A'zolar soni oxirgi marta shu vaqtda yangilangan |

> Bot o'zini o'zi admin qila olmaydi — buni Telegram'da **odam** bajarishi
> shart: guruh → *Manage* → **Administrators** → **Add Admin** → botni tanlang →
> *Delete messages* ni yoqing.

## ⚠️ Muhim eslatmalar

- **Guruhda bot hamma xabarlarni ko'rishi uchun**: @BotFather → `/mybots` → bot → *Bot Settings* → *Group Privacy* → **Turn off**. (Bot admin bo'lsa, bu shart emas.)
- Environment Variable o'zgartirsangiz → Vercel'da **Redeploy** qiling.
- Poster rasmlar brauzerda avtomatik siqiladi (Vercel limiti 4.5MB).
- Vercel Hobby (bepul) rejada bitta so'rov 60 soniyagacha ishlaydi — bu ~50+ guruhga yuborish uchun yetarli.
- Domen o'zgarsa (o'z domeningizni ulasangiz) — `SITE_URL` ni yangilab, `npm run telegram:set` bilan webhook'ni qayta o'rnating.
- `TELEGRAM_WEBHOOK_SECRET` ni almashtirsangiz — webhook'ni **qayta o'rnatish shart**, aks holda Telegram eski kalit bilan yuborib, ilova 403 qaytaradi.

## 🛠 Muammolarni bartaraf etish

### Build xatosi: `DATABASE_URL is required` / `Failed to collect page data for /api/health`

Sabab: `next build` paytida Next.js route modullarini import qiladi, eski kod esa
import paytida `DATABASE_URL` ni majburiy qilardi. Hozir baza ulanishi **lazy**
(birinchi so'rovda) yaratiladi — build `DATABASE_URL` siz ham o'tadi:

```bash
npm run build     # DATABASE_URL bo'lmasa ham exit 0
```

Deploy debug qilish uchun Vercel'da build log'ini tekshiring: **Deployments → (oxirgi) → Building**.

### `npm warn install-scripts ... not yet covered by allowScripts`

npm 12 dan boshlab native paketlarning o'rnatish skriptlari (esbuild, sharp,
unrs-resolver) sukut bo'yicha ishlamaydi. Buni `package.json` dagi
`"allowScripts"` bo'limi hal qiladi (shu loyihada allaqachon qo'shilgan).
Yangi ogohlantirish chiqsa:

```bash
npm approve-scripts --allow-scripts-pending   # ro'yxatni ko'rish (npm 11.16+)
```

va tasdiqlangan paketni `package.json` → `allowScripts` ga qo'shing.

### Telegram `404 Not Found` (setWebhook chaqirganda)

Sabab odatda **token yoki manzil noto'g'ri yozilgan**, kodda emas:

| Xato | To'g'ri |
|---|---|
| `bot<123456:AA...>` | `bot123456:AA...` — `< >` **yozilmaydi** |
| `?url=https://<https://domen>` | `?url=https://domen/api/telegram/webhook` |
| `?url=.../api/webhook` | `?url=.../api/telegram/webhook` |
| `?secret_token=<abc...>` | `?secret_token=abc...` |

Qo'lda URL yozish o'rniga doim skriptdan foydalaning:

```bash
npm run telegram:set -- --url https://agrozbot.vercel.app
```

### Bot javob bermayapti (webhook)

```bash
npm run telegram:doctor
```

`doctor` ketma-ket tekshiradi (7 qadam):

1. token va bot (`getMe`)
2. ilova manzili (`/api/telegram/webhook` javob beradimi)
3. baza va jadvallar/ustunlar (`/api/health`)
4. `TELEGRAM_WEBHOOK_SECRET` mosligi
5. webhook holati (`getWebhookInfo`)
6. guruh privacy (`can_read_all_group_messages`)
7. **guruhlar hisoboti** — har bir guruh uchun 👥 a'zolar soni, 🛡 bot admin
   holati va 🧹 kirdi/chiqdi tozalash ishlashi (bazadagi `groups` jadvalidan
   o'qiladi, `DATABASE_URL` bo'lsa)

Har bir qadam ✅ yoki aniq tuzatish bilan ko'rsatiladi.

Eng ko'p uchraydigan sabablar:

1. **Jadvallar yaratilmagan.** `/start` `DATABASE_URL` jadvallarisiz jim
   qoladi (xato faqat server log'iga yoziladi). Bir marta bajaring:
   ```bash
   DATABASE_URL="postgresql://...neon.tech/...?...sslmode=require" npm run db:push
   ```
2. **Group Privacy yoqilgan.** Bot guruhdagi oddiy xabarlarni ko'rmaydi —
   `doctor` buni ogohlantiradi. @BotFather → `/mybots` → bot →
   *Bot Settings* → *Group Privacy* → **Turn off**, yoki botni guruhda
   **admin** qiling.
3. **Env o'zgargan, lekin Redeploy qilinmagan.** Vercel'da *Environment
   Variables* ni o'zgartirsangiz — **Redeploy** shart.
4. **Secret mos emas** — ilova 403 qaytaradi; `doctor` 3-qadamda ko'rsatadi.
   `TELEGRAM_WEBHOOK_SECRET` ni Vercel'dagi bilan bir xil qilib, webhook'ni
   qayta o'rnating:
   ```bash
   npm run telegram:set
   ```

`pending_update_count` o'sib borsa yoki `last_error_message` bo'lsa —
`npm run telegram:info` bilan ko'ring; ilova xato qaytaryapti (ko'pincha
`DATABASE_URL` noto'g'ri yoki domen o'zgargan).

### `/api/health` 500 yoki 503 qaytarsa

`/api/health` ikki narsani tekshiradi: baza ulanishi **va** jadvallar mavjudligi.

```bash
curl -s https://agrozbot.vercel.app/api/health
```

| Javob | Sabab | Tuzatish |
|---|---|---|
| `{"ok":true,"check":"db+tables"}` | Hammasi joyida | — |
| `503 {"reason":"tables_missing","missing":[...]}` | Baza ulangan, jadvallar yaratilmagan | `DATABASE_URL="..." npm run db:push` |
| `503 {"reason":"schema_outdated","missingColumns":[...]}` | Jadvallar bor, lekin yangi ustunlar qo'shilmagan | `DATABASE_URL="..." npm run db:push` |
| `500 {"reason":"db_unreachable"}` | Baza ulanmayapti | `DATABASE_URL` ni tekshiring (Neon'da `?sslmode=require`) |

> `check` maydoni bo'lmasa — javob **eski deploy**dan. Yangi kodni deploy qiling
> (`git push` yoki Vercel → Redeploy), shundan keyin jadval tekshiruvi ishlaydi.

Lokalda tekshirish:

```bash
curl -i http://localhost:3000/api/health
```

### 🧹 Kirdi/chiqdi (a'zo qo'shildi/chiqdi) xabarlari tozalanmayapti

Tozalash kodi mavjud: `src/lib/webhook.ts` da `new_chat_members` /
`left_chat_member` kelganda `deleteMessage` chaqiriladi. Ishlashi uchun:

1. **Bot guruhda admin** bo'lishi va **Xabarlarni o'chirish** huquqi borligi
   (`deleteMessage` aks holda Telegram'dan `400: not enough rights` oladi —
   xato Vercel → *Logs* ga yoziladi, bot jim qoladi). `clean_log` statistikasi
   **faqat muvaffaqiyatli o'chirishda** oshadi — ya'ni paneldagi
   "Tozalangan xabar" soni ishonchli ko'rsatkich.
2. Guruh kartasidagi **🧹 Kirdi/chiqdi tozalash** belgisi yoqilgan bo'lishi
   (default: yoqilgan).
3. Xabar 48 soatdan eski bo'lmasligi (Telegram cheklovi) — service xabarlar
   darhol kelgani uchun bu amalda muammo bo'lmaydi.

Tekshirish:

```bash
npm run telegram:doctor
```

`doctor` ning 7-qadami har bir guruh uchun jonli yozadi:

```
📋 7. Guruhlar hisoboti (2 ta):
   • Agro dehqonchilik (-1001234567890)
     👥 a'zolar: 152  ·  🛡 admin ✓ (xabar o'chirish ✓)
     🧹 kirdi/chiqdi tozalanadi ✓
```

«admin EMAS ✗» chiqsa: Telegram'da guruh → *Manage* → **Administrators** →
botni admin qiling va *Delete messages* ni yoqing. So'ng paneldagi
**🔄 A'zolar sonini yangilash** tugmasini bosing (yoki botga `/sync` yozing) —
holat yangilanadi.

> **Muhim:** Group Privacy yoqilgan bo'lsa ham Telegram botga **service
> xabarlarni** (a'zo kirdi/chiqdi, nom o'zgardi, qadalgan xabar) yuboradi.
> Ya'ni kirdi/chiqdi tozalash privacy'ga bog'liq emas — faqat admin huquqiga.
> Privacy faqat oddiy guruh xabarlarini ko'rishga ta'sir qiladi.

### 👥 Guruhda a'zolar soni ko'rinmayapti

Panelda `👥 —` bo'lsa, `getChatMemberCount` javob bermagan:

1. Bot o'sha guruhda **a'zo** bo'lishi kerak (chiqarib yuborilgan bo'lsa
   ishlamaydi).
2. Botga shaxsiy chatda `/sync` yozing yoki guruh kartasidagi **↻** /
   yuqoridagi **🔄 A'zolar sonini yangilash** ni bosing.
3. `db:push` bajarilganini tekshiring: `/api/health` →
   `schema_outdated` bo'lmasligi kerak.

Son faqat a'zolik o'zgargan hodisalarda avtomatik yangilanadi: bot guruhga
qo'shilganda, bot admin qilinganda, a'zo kirdi/chiqdi bo'lganda. Har bir oddiy
xabarda Telegram API chaqirilmaydi (tezlik va rate-limit uchun).

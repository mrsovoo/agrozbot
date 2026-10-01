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
3. Guruhda istalgan xabar yozilsa yoki bot qo'shilganda — guruh panelda paydo bo'ladi.
4. Botga shaxsiy chatda `/start` yozing → birinchi yozgan odam admin bo'ladi.

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

`doctor` ketma-ket tekshiradi: token → ilova manzili → secret mosligi →
webhook holati → guruh privacy. Har bir qadam ✅ yoki aniq tuzatish bilan
ko'rsatiladi.

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
| `{"ok":true}` | Hammasi joyida | — |
| `503 {"reason":"tables_missing","missing":[...]}` | Jadvallar yaratilmagan | `DATABASE_URL="..." npm run db:push` |
| `500 {"reason":"db_unreachable"}` | Baza ulanmayapti | `DATABASE_URL` ni tekshiring (Neon'da `?sslmode=require`) |

Lokalda tekshirish:

```bash
curl -i http://localhost:3000/api/health
```

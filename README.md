# agrozbot

Telegram guruhlariga post tarqatuvchi bot va admin panel (Next.js + PostgreSQL + Drizzle).
To'liq joylash yo'riqnomasi: **[DEPLOY.md](./DEPLOY.md)**.

## Ishga tushirish (lokal)

```bash
npm install
cp .env.example .env     # DATABASE_URL, TELEGRAM_BOT_TOKEN, ADMIN_PASSWORD, SITE_URL ni to'ldiring
npm run db:push          # jadvallarni bazaga yaratish
npm run dev              # http://localhost:3000
```

## Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build va ishga tushirish |
| `npm run lint` / `npm run typecheck` | ESLint va TypeScript tekshiruvi |
| `npm run db:push` | Drizzle schema'ni bazaga yuborish |
| `npm run telegram:doctor` | To'liq diagnostika (token, ilova, secret, webhook, privacy, guruhlar) |
| `npm run telegram:info` | Bot va webhook holatini ko'rish |
| `npm run telegram:set [-- --url https://domen]` | Webhook o'rnatish |
| `npm run telegram:delete` | Webhook o'chirish |

## Imkoniyatlar

- **Post tarqatish** — web panel yoki bot orqali matn/rasm postini tanlangan
  guruhlarga tartibli yuborish (Agro / Ferma kategoriyalari bo'yicha avtomatik
  hashtag).
- **Forum guruhlar** — mavzular (topics) avtomatik ro'yxatga olinadi.
- **👥 Guruh a'zolari soni** — har bir guruh uchun `getChatMemberCount` orqali
  olinadi va bazada saqlanadi. Yangilanadi: bot guruhga qo'shilganda, a'zo
  kirdi/chiqdi hodisasida, `/sync` buyrug'i bilan yoki paneldagi
  **🔄 A'zolar sonini yangilash** tugmasi bilan.
- **🛡 Bot admin holati** — `getChatMember` orqali tekshiriladi
  (`bot_is_admin`, `bot_can_delete`). Panelda har bir guruh yonida ko'rinadi:
  bot admin bo'lmasa tozalash ishlamasligi ogohlantiriladi.
- **🧹 Kirdi/chiqdi tozalash** — `new_chat_members` / `left_chat_member` service
  xabarlari avtomatik o'chiriladi (`clean_log` ga yozib boriladi).
  **Shart:** bot guruhda admin va *Xabarlarni o'chirish* huquqi bor
  (`deleteMessage` boshqa holda `not enough rights` qaytaradi).
  Group Privacy yoqilgan bo'lsa ham **service xabarlar keladi** — ya'ni bu
  funksiya privacy'ga bog'liq emas, faqat admin huquqiga.
- **📊 Statistika** — faol guruhlar, jami a'zolar, postlar, tozalangan
  xabarlar soni panel bosh sahifasida.

## `/api/health`

Baza ulanishi **va** jadvallar borligini tekshiradi (`check: "db+tables"`):

| Javob | Ma'nosi |
|---|---|
| `200 {"ok":true}` | Baza ulangan, jadvallar joyida |
| `503 {"reason":"tables_missing","missing":[...]}` | `npm run db:push` bajaring |
| `503 {"reason":"schema_outdated","missingColumns":[...]}` | Yangi ustunlar yo'q — `npm run db:push` bajaring |
| `500 {"reason":"db_unreachable"}` | `DATABASE_URL` noto'g'ri |

## Muhim o'zgaruvchilar

`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_PASSWORD`, `SITE_URL`,
`TELEGRAM_WEBHOOK_SECRET` (ixtiyoriy), `BOT_ADMIN_IDS` (ixtiyoriy).
Batafsil: [.env.example](./.env.example).

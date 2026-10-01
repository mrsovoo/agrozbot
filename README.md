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

- **🤖 Suhbatdosh "agent"** — botga rasm (izoh bilan) yoki matn yuboring:
  bot 4 ta qisqa savol beradi (yo'nalish → uslub/uzunlik → havola →
  qo'shimcha ma'lumot), keyin tayyor matnning **preview** ini ko'rsatadi.
  «✅ Yuborish» — tanlangan guruhlarga tarqatiladi; «🔄 Qayta yozish» —
  boshqacha variant; «✏️ Tahrirlash» — qo'lda o'zgartirish. Suhbat holati
  `bot_drafts.session` (jsonb) da saqlanadi, shuning uchun xabarlar orasida
  uzilmaydi. Matn LLM (OpenAI-mos yoki Gemini) bilan yoziladi — kalit
  sozlanmasa ichki shablon ishlaydi.
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

- **🎨 Monoxrom interfeys** — ChatGPT / Gemini / Claude uslubida oq-qora
  dizayn. Ranglar `src/app/globals.css` dagi dizayn tokenlari orqali beriladi
  va tizim mavzusiga qarab avtomatik almashadi (`prefers-color-scheme`):
  yorug' rejimda oq fon + qora matn, qorong'i rejimda qora fon + oq matn.
  Faqat xato (`--danger`) va ogohlantirish (`--warn`) uchun ikkita yumshoq
  semantik rang qoldirilgan.

## Interfeys (UI/UX)

Dizayn tokenlari va qayta ishlatiladigan komponent klasslari
`src/app/globals.css` da. Ikonalar — `src/components/icons.tsx` dagi inline SVG
(tashqi ikonka kutubxonasi ishlatilmaydi, rangi `currentColor` orqali).

| Token / klass | Vazifasi |
|---|---|
| `--canvas`, `--surface`, `--subtle`, `--subtle-hover` | Fon qatlamlari |
| `--ink`, `--muted`, `--faint` | Matn (asosiy / ikkilamchi / uchinchi daraja) |
| `--line`, `--line-strong` | Chegara chiziqlari |
| `--primary`, `--on-primary` | Yuqori kontrastli tugma (`bg-primary`) |
| `.page-title` / `.page-sub` | Sahifa sarlavhasi va tavsifi |
| `.card-pad` / `.empty` / `.muted-row` | Konteynerlar |
| `.btn` + `.btn-primary` / `.btn-outline` / `.btn-ghost` / `.btn-danger` | Tugmalar (pill shaklida) |
| `.input` / `.input-sm` / `.label` / `.hint` | Forma maydonlari |
| `.badge` / `.badge-ink` / `.badge-warn` / `.badge-danger` | Nishonlar |
| `.nav-item` / `.nav-item-active` | Yon panel navigatsiyasi |
| `.alert-danger` / `.alert-warn` | Bildirishnoma chiziqlari |

> Tailwind v4 ishlatiladi: tokenlar `@theme inline` bilan utility'ga
> aylantiriladi (`bg-canvas`, `text-muted`, `border-line` ...), komponent
> klasslari esa `@layer components` da — shu sababli JSX'dagi oddiy
> utility'lar (masalan `w-full`) ularni bemalol ustidan yozadi.

Mavzuni almashtirish uchun kod o'zgartirish shart emas — brauzer/OS
mavzusi o'zgarishi bilan qayta yuklamasdan almashadi.

## `/api/health`

Baza ulanishi **va** jadvallar borligini tekshiradi (`check: "db+tables"`):

| Javob | Ma'nosi |
|---|---|
| `200 {"ok":true,"ai":{...}}` | Baza ulangan, jadvallar joyida. `ai` — AI yozuvchi holati (`configured:false` bo'lsa shablon) |
| `503 {"reason":"tables_missing","missing":[...]}` | `npm run db:push` bajaring |
| `503 {"reason":"schema_outdated","missingColumns":[...]}` | Yangi ustunlar yo'q — `npm run db:push` bajaring |
| `500 {"reason":"db_unreachable"}` | `DATABASE_URL` noto'g'ri |

## Muhim o'zgaruvchilar

`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_PASSWORD`, `SITE_URL`,
`TELEGRAM_WEBHOOK_SECRET` (ixtiyoriy), `BOT_ADMIN_IDS` (ixtiyoriy).

AI yozuvchi (ixtiyoriy — kalit bo'sh bo'lsa shablon matn yozadi):
`AI_API_KEY` + ixtiyoriy `AI_BASE_URL` / `AI_MODEL` (OpenAI-mos),
yoki `GEMINI_API_KEY` / `GOOGLE_API_KEY` (Gemini).

Batafsil: [.env.example](./.env.example).

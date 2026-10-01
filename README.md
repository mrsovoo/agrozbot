# agrozbot

Telegram guruhlariga post tarqatuvchi bot va admin panel (Next.js + PostgreSQL + Drizzle).
To'liq joylash yo'riqnomasi: **[DEPLOY.md](./DEPLOY.md)**.

> Repo ichida alohida Python loyihasi ham bor: **[agroz-core/](./agroz-core)** —
> foydalanuvchi savollari uchun Q&A boti (matn → Meta Llama/Groq, rasm →
> Google Gemini vision). U **boshqa bot tokeni** bilan ishlaydi va bu repo'ning
> TypeScript qismiga bog'lanmaydi — batafsil uning [README](./agroz-core/README.md)'sida.

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
- **🧭 Bosh menyu va foydalanuvchi profili** — `/start` da uchta yo'nalish
  taklif qilinadi: 🐄 Chorvachilik va Parranda, 🌾 Dehqonchilik va Ekinlar,
  📍 Yaqin atrofdagi Agro-do'kon va Mutaxassislar. Tanlov `user_profiles`
  jadvalida (`interest: farming|livestock`) saqlanadi va keyingi tavsiyalarda
  hisobga olinadi — masalan post yo'nalishi (Agro/Ferma) profilega moslab
  oldindan tanlanadi. Menyudan tanlanmasa, qiziqish matndan avtomatik
  aniqlanadi (ekin/o'g'it/kasallik → farming; chorva/parranda/veterinar →
  livestock).
- **🌿 Rasmli tashxis (AI vision)** — «Rasmli tashxis» rejimida barg, shox
  yoki ekin rasmini yuboring: Gemini yoki OpenAI-mos **vision** model
  kasallik/zararkunandani aniqlab, O'zbekiston bozoridagi dori (Ridomil Gold,
  Bi-58, Koragen ...) va dozasini yozadi. AI kaliti sozlanmagan bo'lsa aniq
  ogohlantirish ko'rsatiladi. Tashxis **barcha foydalanuvchilar** uchun ochiq
  (dehqonlar uchun), post tarqatish esa faqat adminlar uchun.
- **📣 Targ'ibot (CTA) shabloni** — briefda «targ'ibot», «promo», «chaqiriq»
  yoki «@agrozai_bot» bo'lsa, LLM qayta yozmasdan aniq CTA matni qaytariladi
  (dehqonlar va savdo qiluvchilar uchun poster).
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
- **🧠 Fine-tuning xomashyosi (dialoglar)** — agent bilan har bir generatsiya
  `(system, user, assistant)` juftligi sifatida `dialogs` jadvaliga avtomatik
  yoziladi. LLM javoblari (`openai`/`gemini`/`template`) hamda ekspert
  tahrirlari (`human`) bir xil formatda to'planadi. Kuratsiya va export:
  - `GET /api/dialogs` — ro'yxat + hisob (`?verified=true|false`, `?limit=`);
  - `PATCH /api/dialogs/:id` — `{"verified":true}` tasdiqlash yoki
    `{"messages":[...]}` bilan chala javobni tahrirlash;
  - `POST /api/dialogs` — qo'lda namuna qo'shish;
  - `GET /api/dialogs/export` — **JSONL** fayl (`{"messages":[...]}` bir
    qatorda), default faqat tasdiqlangan (`verified=true`) namunalar;
    `?verified=all|false` bilan boshqacha.
  Hammasi panel cookie'si (`isAuthed`) bilan himoyalangan. Yangi suhbatlar
  `npm run db:push` dan keyin yig'ila boshlaydi.

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

AI yozuvchi va rasmli tashxis (ixtiyoriy — kalit bo'sh bo'lsa shablon matn
yozadi, tashxis esa ogohlantiradi): `AI_API_KEY` + ixtiyoriy `AI_BASE_URL` /
`AI_MODEL` (OpenAI-mos, vision qo'llab-quvvatlasa), yoki `GEMINI_API_KEY` /
`GOOGLE_API_KEY` (Gemini — `gemini-2.0-flash` rasmni ham qo'llaydi).

Batafsil: [.env.example](./.env.example).

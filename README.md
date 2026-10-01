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
| `npm run telegram:doctor` | To'liq diagnostika (token, ilova, secret, webhook, privacy) |
| `npm run telegram:info` | Bot va webhook holatini ko'rish |
| `npm run telegram:set [-- --url https://domen]` | Webhook o'rnatish |
| `npm run telegram:delete` | Webhook o'chirish |

## Muhim o'zgaruvchilar

`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_PASSWORD`, `SITE_URL`,
`TELEGRAM_WEBHOOK_SECRET` (ixtiyoriy), `BOT_ADMIN_IDS` (ixtiyoriy).
Batafsil: [.env.example](./.env.example).

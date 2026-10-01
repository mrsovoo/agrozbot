# 🚀 Vercelga joylash yo'riqnomasi

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
3. **Environment Variables** bo'limiga qo'shing:

| Nomi | Qiymati |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `TELEGRAM_BOT_TOKEN` | @BotFather tokeni |
| `ADMIN_PASSWORD` | O'zingizning kuchli parolingiz |
| `TELEGRAM_WEBHOOK_SECRET` | ixtiyoriy, masalan `agro_ferma_2026_secret` |
| `BOT_ADMIN_IDS` | ixtiyoriy, Telegram ID'ingiz |

4. **Deploy** tugmasini bosing. 1–2 daqiqada `https://loyiha-nomi.vercel.app` tayyor bo'ladi.

## 5-qadam. Botni ulash (webhook)

1. `https://loyiha-nomi.vercel.app` ga kiring → parol bilan kiring.
2. **⚙️ Sozlamalar** → manzil avtomatik to'ldirilgan bo'ladi → **O'rnatish**.
3. "✅ Webhook o'rnatildi" chiqadi.

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
- Domen o'zgarsa (o'z domeningizni ulasangiz) — Sozlamalardan webhook'ni qayta o'rnating.

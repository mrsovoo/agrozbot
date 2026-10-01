"use client";

import { useEffect, useState } from "react";

type Info = {
  configured: boolean;
  message?: string;
  hasSecret?: boolean;
  suggestedUrl?: string | null;
  me?: { ok: boolean; result?: { username?: string; first_name?: string } };
  webhook?: {
    ok: boolean;
    result?: { url?: string; pending_update_count?: number };
  };
};

export default function SettingsPanel() {
  const [info, setInfo] = useState<Info | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load(): Promise<Info | null> {
    const res = await fetch("/api/telegram/setup");
    if (!res.ok) return null;
    const data: Info = await res.json();
    setInfo(data);
    return data;
  }

  useEffect(() => {
    async function init() {
      const data = await load();
      // Manzil: SITE_URL sozlangan bo'lsa o'sha, aks holda joriy domen
      const fallback =
        typeof window !== "undefined" ? window.location.origin : "";
      const suggested = data?.suggestedUrl?.trim();
      if (suggested) setUrl(suggested);
      else if (fallback) setUrl(fallback);
    }
    init();
  }, []);

  async function setWebhook() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/telegram/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", url }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(
      data.ok
        ? `✅ Webhook o'rnatildi: ${data.webhookUrl}`
        : `❌ ${data.description || "Xatolik"}`,
    );
    load();
  }

  async function deleteWebhook() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/telegram/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(data.ok ? "✅ Webhook o'chirildi" : `❌ ${data.description}`);
    load();
  }

  const botUser = info?.me?.result?.username;
  const webhookUrl = info?.webhook?.result?.url;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Sozlamalar</h1>
        <p className="mt-1 text-sm text-slate-400">
          Botni Telegram bilan ulash va holatini tekshirish.
        </p>
      </header>

      {/* Bot holati */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold">🤖 Bot holati</h3>
        {!info ? (
          <p className="mt-3 text-sm text-slate-400">Tekshirilmoqda...</p>
        ) : !info.configured ? (
          <div className="mt-3 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            ⚠️ <b>TELEGRAM_BOT_TOKEN</b> sozlanmagan. Sandbox muhit
            sozlamalaridan bot tokenini qo&apos;shing, so&apos;ng qayta
            yuklang.
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-300">
              Bot:{" "}
              {botUser ? (
                <span className="font-semibold text-emerald-300">
                  @{botUser}
                </span>
              ) : (
                <span className="text-rose-300">ulanmadi</span>
              )}
            </p>
            <p className="text-slate-300">
              Webhook:{" "}
              {webhookUrl ? (
                <span className="break-all font-mono text-xs text-emerald-300">
                  {webhookUrl}
                </span>
              ) : (
                <span className="text-slate-500">o&apos;rnatilmagan</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Webhook */}
      {info?.configured && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-semibold">🔗 Webhook o&apos;rnatish</h3>
          <p className="mt-1 text-sm text-slate-400">
            Ilovangizning ommaviy (public https) manzilini kiriting. Bot
            yangilanishlar shu manzilga keladi.
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Maxfiy kalit (TELEGRAM_WEBHOOK_SECRET):{" "}
            {info?.hasSecret ? (
              <span className="text-emerald-300">o&apos;rnatilgan</span>
            ) : (
              <span className="text-amber-300">
                yo&apos;q — ixtiyoriy, lekin tavsiya etiladi
              </span>
            )}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://sizning-domen.com"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <button
              onClick={setWebhook}
              disabled={busy}
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              O&apos;rnatish
            </button>
            <button
              onClick={deleteWebhook}
              disabled={busy}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm transition hover:bg-slate-700 disabled:opacity-60"
            >
              O&apos;chirish
            </button>
          </div>
          {msg && <p className="mt-3 break-all text-sm text-slate-300">{msg}</p>}
        </div>
      )}

      {/* Yo'riqnoma */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold">📖 Qanday ishga tushiriladi?</h3>
        <ol className="mt-3 space-y-2 text-sm text-slate-300">
          <li>
            <b>1.</b> @BotFather dan bot yarating va tokenni oling.
          </li>
          <li>
            <b>2.</b> Tokenni muhit o&apos;zgaruvchisi{" "}
            <code className="rounded bg-slate-800 px-1 text-emerald-300">
              TELEGRAM_BOT_TOKEN
            </code>{" "}
            ga qo&apos;shing.
          </li>
          <li>
            <b>3.</b> Yuqorida webhook manzilini o&apos;rnating —{" "}
            <code className="rounded bg-slate-800 px-1 text-emerald-300">
              SITE_URL
            </code>{" "}
            sozlangan bo&apos;lsa avtomatik to&apos;ldiriladi.
          </li>
          <li>
            <b>4.</b> Botni guruhga qo&apos;shing va <b>admin</b> qiling (xabar
            o&apos;chirish huquqi bilan). Guruh avtomatik ro&apos;yxatga
            olinadi.
          </li>
          <li>
            <b>5.</b> Botga Telegram orqali <code className="rounded bg-slate-800 px-1">/start</code>{" "}
            yozing — birinchi foydalanuvchi avtomatik admin bo&apos;ladi.
          </li>
          <li>
            <b>6.</b> Endi botga matn yoki rasm yuboring yoki shu web paneldan
            post tarqating. 🎉
          </li>
        </ol>
      </div>
    </div>
  );
}

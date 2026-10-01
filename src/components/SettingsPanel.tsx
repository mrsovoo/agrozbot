"use client";

import { useEffect, useState } from "react";
import {
  IconAlert,
  IconBot,
  IconCheck,
  IconExternal,
  IconInfo,
  IconRefresh,
  IconX,
} from "./icons";

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
        ? `Webhook o'rnatildi: ${data.webhookUrl}`
        : data.description || "Xatolik",
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
    setMsg(data.ok ? "Webhook o'chirildi" : data.description || "Xatolik");
    load();
  }

  const botUser = info?.me?.result?.username;
  const webhookUrl = info?.webhook?.result?.url;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Sozlamalar</h1>
        <p className="page-sub">
          Botni Telegram bilan ulash va holatini tekshirish.
        </p>
      </header>

      {/* Bot holati */}
      <div className="card-pad">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <IconBot size={17} />
          Bot holati
        </h3>
        {!info ? (
          <p className="mt-3 text-sm text-muted">Tekshirilmoqda...</p>
        ) : !info.configured ? (
          <div className="alert-warn mt-3 flex items-start gap-2">
            <IconAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              <b>TELEGRAM_BOT_TOKEN</b> sozlanmagan. Muhit
              o&apos;zgaruvchilariga bot tokenini qo&apos;shing, so&apos;ng
              qayta yuklang.
            </span>
          </div>
        ) : (
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="w-24 shrink-0 text-muted">Bot</dt>
              <dd>
                {botUser ? (
                  <span className="badge badge-ink font-mono">@{botUser}</span>
                ) : (
                  <span className="badge badge-danger">
                    <IconX size={12} /> ulanmadi
                  </span>
                )}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="w-24 shrink-0 text-muted">Webhook</dt>
              <dd className="min-w-0">
                {webhookUrl ? (
                  <span className="inline-flex items-center gap-1.5">
                    <IconCheck size={14} className="shrink-0 text-ink" />
                    <span className="font-mono text-xs break-all text-ink">
                      {webhookUrl}
                    </span>
                  </span>
                ) : (
                  <span className="badge">
                    <IconX size={12} /> o&apos;rnatilmagan
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Webhook */}
      {info?.configured && (
        <div className="card-pad">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <IconExternal size={17} />
            Webhook o&apos;rnatish
          </h3>
          <p className="page-sub mt-1">
            Ilovangizning ommaviy (public https) manzilini kiriting. Bot
            yangilanishlar shu manzilga keladi.
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Maxfiy kalit (TELEGRAM_WEBHOOK_SECRET):</span>
            {info?.hasSecret ? (
              <span className="badge badge-ink">
                <IconCheck size={12} /> o&apos;rnatilgan
              </span>
            ) : (
              <span className="badge badge-warn">
                <IconAlert size={12} /> yo&apos;q — tavsiya etiladi
              </span>
            )}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://sizning-domen.com"
              aria-label="Webhook manzili"
              className="input flex-1"
            />
            <button onClick={setWebhook} disabled={busy} className="btn btn-primary">
              {busy ? (
                <>
                  <IconRefresh size={16} className="animate-spin" />
                  Kutilyapti...
                </>
              ) : (
                "O'rnatish"
              )}
            </button>
            <button
              onClick={deleteWebhook}
              disabled={busy}
              className="btn btn-outline"
            >
              O&apos;chirish
            </button>
          </div>
          {msg && (
            <p className="muted-row mt-3 flex items-start gap-2">
              <IconInfo size={15} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1 break-all">{msg}</span>
            </p>
          )}
        </div>
      )}

      {/* Yo'riqnoma */}
      <div className="card-pad">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <IconInfo size={17} />
          Qanday ishga tushiriladi?
        </h3>
        <ol className="mt-3 space-y-2.5 text-sm text-muted">
          <li>
            <b className="text-ink">1.</b> @BotFather dan bot yarating va
            tokenni oling.
          </li>
          <li>
            <b className="text-ink">2.</b> Tokenni muhit o&apos;zgaruvchisi{" "}
            <code className="rounded border border-line bg-subtle px-1 font-mono text-xs text-ink">
              TELEGRAM_BOT_TOKEN
            </code>{" "}
            ga qo&apos;shing.
          </li>
          <li>
            <b className="text-ink">3.</b> Yuqorida webhook manzilini
            o&apos;rnating —{" "}
            <code className="rounded border border-line bg-subtle px-1 font-mono text-xs text-ink">
              SITE_URL
            </code>{" "}
            sozlangan bo&apos;lsa avtomatik to&apos;ldiriladi.
          </li>
          <li>
            <b className="text-ink">4.</b> Botni guruhga qo&apos;shing va{" "}
            <b className="text-ink">admin</b> qiling (xabar o&apos;chirish
            huquqi bilan). Guruh avtomatik ro&apos;yxatga olinadi.
          </li>
          <li>
            <b className="text-ink">5.</b> Botga Telegram orqali{" "}
            <code className="rounded border border-line bg-subtle px-1 font-mono text-xs text-ink">
              /start
            </code>{" "}
            yozing — birinchi foydalanuvchi avtomatik admin bo&apos;ladi.
          </li>
          <li>
            <b className="text-ink">6.</b> Endi botga matn yoki rasm yuboring
            yoki shu web paneldan post tarqating.
          </li>
        </ol>
      </div>
    </div>
  );
}

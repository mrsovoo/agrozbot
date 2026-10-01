"use client";

import { useEffect, useState } from "react";
import type { PostDTO } from "@/lib/types";

const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "Yuborildi", cls: "bg-emerald-500/15 text-emerald-300" },
  partial: { label: "Qisman", cls: "bg-amber-500/15 text-amber-300" },
  failed: { label: "Xato", cls: "bg-rose-500/15 text-rose-300" },
  sending: { label: "Yuborilmoqda", cls: "bg-sky-500/15 text-sky-300" },
  draft: { label: "Qoralama", cls: "bg-slate-500/15 text-slate-300" },
};

export default function PostsHistory() {
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Postlar tarixi</h1>
        <p className="mt-1 text-sm text-slate-400">
          Web panel va bot orqali yuborilgan barcha postlar.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Yuklanmoqda...</p>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-10 text-center">
          <p className="text-4xl">🗂</p>
          <p className="mt-3 font-medium">Hali post yo&apos;q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const st = STATUS[p.status] || STATUS.draft;
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex gap-4">
                  {p.hasImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/posts/${p.id}/image`}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-lg border border-slate-700 object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}
                      >
                        {st.label}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                        {p.source === "bot" ? "🤖 Bot" : "💻 Web"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(p.createdAt).toLocaleString("uz-UZ")}
                      </span>
                    </div>
                    {p.title && (
                      <p className="mt-1.5 font-semibold">{p.title}</p>
                    )}
                    {p.body && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                        {p.body}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.targets.map((t) => (
                        <span
                          key={t.id}
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            t.status === "sent"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-rose-500/10 text-rose-300"
                          }`}
                          title={t.error || ""}
                        >
                          {t.status === "sent" ? "✓" : "✗"} {t.group}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

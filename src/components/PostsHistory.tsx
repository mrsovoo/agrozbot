"use client";

import { useEffect, useState } from "react";
import type { PostDTO } from "@/lib/types";
import {
  IconArchive,
  IconBot,
  IconCheck,
  IconClock,
  IconMonitor,
  IconX,
} from "./icons";

const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "Yuborildi", cls: "badge-ink" },
  partial: { label: "Qisman", cls: "badge-warn" },
  failed: { label: "Xato", cls: "badge-danger" },
  sending: { label: "Yuborilmoqda", cls: "badge" },
  draft: { label: "Qoralama", cls: "badge" },
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
        <h1 className="page-title">Postlar tarixi</h1>
        <p className="page-sub">
          Web panel va bot orqali yuborilgan barcha postlar.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted">Yuklanmoqda...</p>
      ) : posts.length === 0 ? (
        <div className="empty">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-muted">
            <IconArchive size={20} />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">
            Hali post yo&apos;q
          </p>
          <p className="mt-1 text-sm text-muted">
            Birinchi postingizni «Yangi post» sahifasidan yarating.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const st = STATUS[p.status] || STATUS.draft;
            return (
              <div key={p.id} className="card-pad">
                <div className="flex gap-4">
                  {p.hasImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/posts/${p.id}/image`}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-xl border border-line object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      <span className="badge">
                        {p.source === "bot" ? (
                          <>
                            <IconBot size={12} /> Bot
                          </>
                        ) : (
                          <>
                            <IconMonitor size={12} /> Web
                          </>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                        <IconClock size={12} />
                        {new Date(p.createdAt).toLocaleString("uz-UZ")}
                      </span>
                    </div>
                    {p.title && (
                      <p className="mt-2 text-sm font-semibold text-ink">
                        {p.title}
                      </p>
                    )}
                    {p.body && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {p.body}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {p.targets.map((t) => (
                        <span
                          key={t.id}
                          className={`badge ${
                            t.status === "sent" ? "" : "badge-danger"
                          }`}
                          title={t.error || ""}
                        >
                          {t.status === "sent" ? (
                            <IconCheck size={12} />
                          ) : (
                            <IconX size={12} />
                          )}
                          {t.group}
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

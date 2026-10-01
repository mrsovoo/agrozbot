"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GroupDTO } from "@/lib/types";
import { compressImage } from "@/lib/compressImage";
import {
  IconAlert,
  IconCheck,
  IconImage,
  IconUsers,
  IconX,
} from "./icons";

type Selection = Record<number, { selected: boolean; threadId: string }>;

function catLabel(c: string) {
  if (c === "agro") return "Agro dehqonchilik";
  if (c === "ferma") return "Ferma va chorvachilik";
  return "Boshqa";
}

export default function Composer() {
  const [groups, setGroups] = useState<GroupDTO[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [sel, setSel] = useState<Selection>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(
    null,
  );
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => {
        const gs: GroupDTO[] = (d.groups || []).filter(
          (g: GroupDTO) => g.active,
        );
        setGroups(gs);
      })
      .catch(() => {});
  }, []);

  function toggle(id: number) {
    setSel((s) => ({
      ...s,
      [id]: {
        selected: !s[id]?.selected,
        threadId: s[id]?.threadId || "",
      },
    }));
  }

  function selectCategory(cat: string) {
    setSel((s) => {
      const next = { ...s };
      const ids = groups.filter((g) => g.category === cat).map((g) => g.id);
      const allSelected = ids.every((id) => next[id]?.selected);
      for (const id of ids) {
        next[id] = { selected: !allSelected, threadId: next[id]?.threadId || "" };
      }
      return next;
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setImage(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  const selectedCount = useMemo(
    () => Object.values(sel).filter((x) => x.selected).length,
    [sel],
  );

  async function send() {
    setError("");
    setResult(null);
    const targets = Object.entries(sel)
      .filter(([, v]) => v.selected)
      .map(([id, v]) => ({
        groupId: Number(id),
        threadId: v.threadId || null,
      }));
    if (targets.length === 0) {
      setError("Kamida bitta guruh tanlang");
      return;
    }
    if (!title.trim() && !body.trim() && !image) {
      setError("Matn yoki rasm kiriting");
      return;
    }
    setSending(true);
    const fd = new FormData();
    fd.append("title", title);
    fd.append("body", body);
    fd.append("targets", JSON.stringify(targets));
    if (image) {
      const compressed = await compressImage(image);
      fd.append("image", compressed);
    }
    const res = await fetch("/api/posts", { method: "POST", body: fd });
    setSending(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setResult({ sent: data.sent, failed: data.failed });
      setTitle("");
      setBody("");
      setImage(null);
      setPreview("");
      setSel({});
      if (fileRef.current) fileRef.current.value = "";
    } else {
      setError(data.error || "Xatolik yuz berdi");
    }
  }

  const byCat = {
    agro: groups.filter((g) => g.category === "agro"),
    ferma: groups.filter((g) => g.category === "ferma"),
    boshqa: groups.filter((g) => g.category === "boshqa"),
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Yangi post</h1>
        <p className="page-sub">
          Matn va poster rasmini bir vaqtda kerakli guruhlarga tarqating.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chap: kontent */}
        <div className="space-y-4">
          <div className="card-pad">
            <label className="label mb-1.5">Sarlavha (ixtiyoriy)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Yangi hosil mavsumi boshlandi"
              className="input"
            />
            <label className="label mt-4 mb-1.5">Matn</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              placeholder="Post matnini yozing..."
              className="input resize-y"
            />
            <label className="label mt-4 mb-1.5">Poster rasm (ixtiyoriy)</label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-3 text-sm text-muted transition-colors hover:bg-subtle">
              <IconImage size={18} />
              <span className="min-w-0 flex-1 truncate">
                {image ? image.name : "Rasm tanlash (jpg, png...)"}
              </span>
              <span className="badge">Tanlash</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFile}
                className="hidden"
              />
            </label>
            {preview && (
              <div className="relative mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="preview"
                  className="max-h-56 w-full rounded-xl border border-line object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null);
                    setPreview("");
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  title="Rasmni olib tashlash"
                  aria-label="Rasmni olib tashlash"
                  className="btn btn-outline btn-icon absolute top-2 right-2 bg-surface"
                >
                  <IconX size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* O'ng: guruhlar */}
        <div className="space-y-4">
          <div className="card-pad">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <IconUsers size={17} />
                Qaysi guruhlarga?
              </h3>
              <span className="badge badge-ink">
                {selectedCount} ta tanlangan
              </span>
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-muted">
                Faol guruh yo&apos;q. Avval botni guruhga qo&apos;shing.
              </p>
            ) : (
              <div className="space-y-5">
                {(["agro", "ferma", "boshqa"] as const).map((cat) =>
                  byCat[cat].length ? (
                    <div key={cat}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">
                          {catLabel(cat)}
                        </span>
                        <button
                          onClick={() => selectCategory(cat)}
                          className="text-xs font-medium text-muted hover:text-ink hover:underline"
                        >
                          Barchasi
                        </button>
                      </div>
                      <div className="space-y-2">
                        {byCat[cat].map((g) => {
                          const s = sel[g.id];
                          return (
                            <div
                              key={g.id}
                              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                                s?.selected
                                  ? "border-line-strong bg-subtle"
                                  : "border-line hover:bg-subtle"
                              }`}
                            >
                              <label className="flex cursor-pointer items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={!!s?.selected}
                                  onChange={() => toggle(g.id)}
                                  className="h-4 w-4 shrink-0"
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                  {g.title}
                                </span>
                                {g.isForum && (
                                  <span className="badge">forum</span>
                                )}
                              </label>
                              {s?.selected && g.isForum && (
                                <div className="mt-2.5 pl-7">
                                  <input
                                    value={s.threadId}
                                    onChange={(e) =>
                                      setSel((st) => ({
                                        ...st,
                                        [g.id]: {
                                          selected: true,
                                          threadId: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="Mavzu (topic) ID — ixtiyoriy"
                                    className="input input-sm"
                                  />
                                  {g.topics.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {g.topics.map((t) => (
                                        <button
                                          key={t.id}
                                          onClick={() =>
                                            setSel((st) => ({
                                              ...st,
                                              [g.id]: {
                                                selected: true,
                                                threadId: t.threadId,
                                              },
                                            }))
                                          }
                                          className={`badge hover:bg-subtle-hover ${
                                            s.threadId === t.threadId
                                              ? "badge-ink"
                                              : ""
                                          }`}
                                        >
                                          {t.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="alert-danger flex items-center gap-2" role="alert">
              <IconAlert size={16} />
              {error}
            </p>
          )}
          {result && (
            <p className="muted-row flex items-center gap-2">
              <IconCheck size={16} />
              Yuborildi! Muvaffaqiyatli: {result.sent}
              {result.failed ? ` · Xato: ${result.failed}` : ""}
            </p>
          )}

          <button onClick={send} disabled={sending} className="btn btn-primary w-full py-3">
            {sending ? "Yuborilmoqda..." : "Guruhlarga yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}

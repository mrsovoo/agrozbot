"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GroupDTO } from "@/lib/types";
import { compressImage } from "@/lib/compressImage";

type Selection = Record<number, { selected: boolean; threadId: string }>;

function catLabel(c: string) {
  if (c === "agro") return "🌾 Agro";
  if (c === "ferma") return "🐄 Ferma";
  return "📋 Boshqa";
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
        <h1 className="text-2xl font-bold">Yangi post</h1>
        <p className="mt-1 text-sm text-slate-400">
          Matn va poster rasmini bir vaqtda kerakli guruhlarga tarqating.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chap: kontent */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Sarlavha (ixtiyoriy)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Yangi hosil mavsumi boshlandi"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <label className="mb-1.5 mt-4 block text-sm font-medium text-slate-300">
              Matn
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              placeholder="Post matnini yozing..."
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <label className="mb-1.5 mt-4 block text-sm font-medium text-slate-300">
              Poster rasm (ixtiyoriy)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFile}
              className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-600"
            />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="preview"
                className="mt-3 max-h-56 rounded-lg border border-slate-700 object-contain"
              />
            )}
          </div>
        </div>

        {/* O'ng: guruhlar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Qaysi guruhlarga?</h3>
              <span className="text-xs text-slate-400">
                {selectedCount} ta tanlangan
              </span>
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-slate-400">
                Faol guruh yo&apos;q. Avval botni guruhga qo&apos;shing.
              </p>
            ) : (
              <div className="space-y-4">
                {(["agro", "ferma", "boshqa"] as const).map((cat) =>
                  byCat[cat].length ? (
                    <div key={cat}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {catLabel(cat)}
                        </span>
                        <button
                          onClick={() => selectCategory(cat)}
                          className="text-xs text-emerald-400 hover:underline"
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
                              className={`rounded-lg border p-2.5 transition ${
                                s?.selected
                                  ? "border-emerald-500/50 bg-emerald-500/10"
                                  : "border-slate-700 bg-slate-800"
                              }`}
                            >
                              <label className="flex cursor-pointer items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={!!s?.selected}
                                  onChange={() => toggle(g.id)}
                                  className="h-4 w-4 accent-emerald-500"
                                />
                                <span className="flex-1 truncate text-sm">
                                  {g.title}
                                </span>
                              </label>
                              {s?.selected && g.isForum && (
                                <div className="mt-2 pl-7">
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
                                    className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-500"
                                  />
                                  {g.topics.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
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
                                          className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-600"
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
            <p className="rounded-lg bg-rose-500/15 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          )}
          {result && (
            <p className="rounded-lg bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">
              ✅ Yuborildi! Muvaffaqiyatli: {result.sent}
              {result.failed ? ` · Xato: ${result.failed}` : ""}
            </p>
          )}

          <button
            onClick={send}
            disabled={sending}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {sending ? "⏳ Yuborilmoqda..." : "📤 Guruhlarga yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}

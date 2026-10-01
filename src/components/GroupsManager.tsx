"use client";

import { useCallback, useEffect, useState } from "react";
import type { GroupDTO } from "@/lib/types";

const CATEGORIES = [
  { value: "agro", label: "🌾 Agro dehqonchilik" },
  { value: "ferma", label: "🐄 Ferma va chorvachilik" },
  { value: "boshqa", label: "📋 Boshqa" },
];

function categoryLabel(c: string) {
  return CATEGORIES.find((x) => x.value === c)?.label || "📋 Boshqa";
}

export default function GroupsManager() {
  const [groups, setGroups] = useState<GroupDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newChatId, setNewChatId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState("agro");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/groups");
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: number, patch: Record<string, unknown>) {
    setGroups((gs) =>
      gs.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );
    await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function remove(id: number) {
    if (!confirm("Guruhni ro'yxatdan o'chirmoqchimisiz?")) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    load();
  }

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: newChatId,
        title: newTitle,
        category: newCat,
      }),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewChatId("");
      setNewTitle("");
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || "Xatolik");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guruhlar</h1>
          <p className="mt-1 text-sm text-slate-400">
            Botni guruhga admin qilib qo&apos;shsangiz, guruh avtomatik
            paydo bo&apos;ladi.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-700"
        >
          ➕ Qo&apos;lda qo&apos;shish
        </button>
      </header>

      {showAdd && (
        <form
          onSubmit={addGroup}
          className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Chat ID (masalan -1001234567890)
            </label>
            <input
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="-100..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Nomi</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Guruh nomi"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Kategoriya
            </label>
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Qo&apos;shish
            </button>
            {msg && <span className="text-sm text-rose-400">{msg}</span>}
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Yuklanmoqda...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-10 text-center">
          <p className="text-4xl">📭</p>
          <p className="mt-3 font-medium">Hali guruh yo&apos;q</p>
          <p className="mt-1 text-sm text-slate-400">
            Botni guruhga admin qilib qo&apos;shing yoki Chat ID orqali
            qo&apos;shing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className={`rounded-2xl border bg-slate-900 p-5 ${
                g.active ? "border-slate-800" : "border-slate-800/50 opacity-60"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{g.title}</h3>
                    {g.isForum && (
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                        FORUM
                      </span>
                    )}
                    {!g.active && (
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                        NOFAOL
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {categoryLabel(g.category)} · ID: {g.chatId}
                  </p>
                  {g.topics.length > 0 && (
                    <p className="mt-2 text-xs text-slate-400">
                      Mavzular: {g.topics.map((t) => t.name).join(", ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(g.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  🗑 O&apos;chirish
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <select
                  value={g.category}
                  onChange={(e) =>
                    patch(g.id, { category: e.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={g.cleanJoinLeave}
                    onChange={(e) =>
                      patch(g.id, { cleanJoinLeave: e.target.checked })
                    }
                    className="h-4 w-4 accent-emerald-500"
                  />
                  🧹 Kirdi/chiqdi tozalash
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={g.active}
                    onChange={(e) => patch(g.id, { active: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Faol
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

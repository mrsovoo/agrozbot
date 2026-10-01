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

// Oxirgi sinxronlash vaqtini qisqa ko'rinishda chiqaradi
function syncedAtLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GroupsManager() {
  const [groups, setGroups] = useState<GroupDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newChatId, setNewChatId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState("agro");
  const [msg, setMsg] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncing, setSyncing] = useState(false);

  const fetchGroups = useCallback(async (): Promise<GroupDTO[] | null> => {
    const res = await fetch("/api/groups");
    if (!res.ok) return null;
    const data = await res.json();
    return data.groups as GroupDTO[];
  }, []);

  // Qo'lda yangilash (qo'shish/o'chirishdan keyin) — spinner bilan
  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchGroups();
    if (list) setGroups(list);
    setLoading(false);
  }, [fetchGroups]);

  useEffect(() => {
    // MUHIM: effect ichida setState ni sinxron chaqirmaymiz
    // (react-hooks/set-state-in-effect) — setState faqat `await` dan keyin.
    let cancelled = false;
    void (async () => {
      const list = await fetchGroups();
      if (cancelled) return;
      if (list) setGroups(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchGroups]);

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

  // A'zolar soni + bot admin holatini Telegram'dan qayta o'qish
  async function refreshMeta(id?: number) {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/groups/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setSyncMsg(
          `✅ Yangilandi: ${d.total} guruh · 👥 ${d.members} a'zo · ` +
            `bot admin ${d.adminOk}/${d.total}` +
            (d.failed ? ` · o'qilmadi: ${d.failed}` : ""),
        );
      } else {
        setSyncMsg(`❌ ${d.detail || d.error || "Yangilab bo'lmadi"}`);
      }
    } catch {
      setSyncMsg("❌ Tarmoq xatosi");
    }
    setSyncing(false);
    await load();
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
      const data = await res.json().catch(() => ({}));
      if (data.warning) setSyncMsg(`⚠️ ${data.warning}`);
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
            Botni guruhga admin qilib qo&apos;shsangiz, guruh avtomatik paydo
            bo&apos;ladi. A&apos;zolar soni va botning admin holati shu yerda
            ko&apos;rinadi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => refreshMeta()}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-700 disabled:opacity-60"
          >
            {syncing ? "⏳ Yangilanmoqda..." : "🔄 A'zolar sonini yangilash"}
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-700"
          >
            ➕ Qo&apos;lda qo&apos;shish
          </button>
        </div>
      </header>

      {syncMsg && (
        <p className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          {syncMsg}
        </p>
      )}

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
                    {syncedAtLabel(g.memberCountUpdatedAt)
                      ? ` · ↻ ${syncedAtLabel(g.memberCountUpdatedAt)}`
                      : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-200">
                      👥 {g.memberCount ?? "—"} a&apos;zo
                    </span>
                    {g.botIsAdmin ? (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                        🛡 Bot admin{g.botCanDelete ? " (o&apos;chirish ✓)" : " (o&apos;chirish ✗)"}
                      </span>
                    ) : (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        ⚠️ Bot admin emas
                      </span>
                    )}
                  </div>
                  {!g.botIsAdmin && (
                    <p className="mt-2 text-xs text-amber-300/90">
                      Kirdi/chiqdi xabarlari tozalanmaydi: botni guruhda admin
                      qiling (xabar o&apos;chirish huquqi bilan).
                    </p>
                  )}
                  {g.botIsAdmin && !g.botCanDelete && (
                    <p className="mt-2 text-xs text-amber-300/90">
                      Bot admin, lekin <b>xabar o&apos;chirish</b> huquqi yo&apos;q
                      — kirdi/chiqdi tozalanmaydi.
                    </p>
                  )}
                  {g.topics.length > 0 && (
                    <p className="mt-2 text-xs text-slate-400">
                      Mavzular: {g.topics.map((t) => t.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => refreshMeta(g.id)}
                    disabled={syncing}
                    title="A'zolar sonini Telegram'dan yangilash"
                    className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-700 hover:text-slate-200 disabled:opacity-60"
                  >
                    ↻
                  </button>
                  <button
                    onClick={() => remove(g.id)}
                    className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    🗑 O&apos;chirish
                  </button>
                </div>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import type { GroupDTO } from "@/lib/types";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconPlus,
  IconRefresh,
  IconShield,
  IconTrash,
  IconUsers,
  IconX,
} from "./icons";

const CATEGORIES = [
  { value: "agro", label: "Agro dehqonchilik" },
  { value: "ferma", label: "Ferma va chorvachilik" },
  { value: "boshqa", label: "Boshqa" },
];

function categoryLabel(c: string) {
  return CATEGORIES.find((x) => x.value === c)?.label || "Boshqa";
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
          `Yangilandi: ${d.total} guruh · ${d.members} a'zo · ` +
            `bot admin ${d.adminOk}/${d.total}` +
            (d.failed ? ` · o'qilmadi: ${d.failed}` : ""),
        );
      } else {
        setSyncMsg(`${d.detail || d.error || "Yangilab bo'lmadi"}`);
      }
    } catch {
      setSyncMsg("Tarmoq xatosi");
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
      if (data.warning) setSyncMsg(data.warning);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || "Xatolik");
    }
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">Guruhlar</h1>
          <p className="page-sub">
            Botni guruhga admin qilib qo&apos;shsangiz, guruh avtomatik paydo
            bo&apos;ladi. A&apos;zolar soni va botning admin holati shu yerda
            ko&apos;rinadi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => refreshMeta()}
            disabled={syncing}
            className="btn btn-outline"
          >
            <IconRefresh
              size={16}
              className={syncing ? "animate-spin" : undefined}
            />
            {syncing ? "Yangilanmoqda..." : "A'zolar sonini yangilash"}
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="btn btn-primary"
          >
            <IconPlus size={16} />
            Qo&apos;lda qo&apos;shish
          </button>
        </div>
      </header>

      {syncMsg && (
        <p className="muted-row flex items-center gap-2">
          <IconClock size={15} />
          <span className="min-w-0 flex-1">{syncMsg}</span>
        </p>
      )}

      {showAdd && (
        <form
          onSubmit={addGroup}
          className="card-pad grid gap-3 sm:grid-cols-2"
        >
          <div>
            <label className="hint mb-1 block">
              Chat ID (masalan -1001234567890)
            </label>
            <input
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              className="input"
              placeholder="-100..."
            />
          </div>
          <div>
            <label className="hint mb-1 block">Nomi</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="input"
              placeholder="Guruh nomi"
            />
          </div>
          <div>
            <label className="hint mb-1 block">Kategoriya</label>
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="input"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <button type="submit" className="btn btn-primary">
              Qo&apos;shish
            </button>
            {msg && (
              <span className="flex items-center gap-1.5 text-sm text-danger">
                <IconAlert size={15} />
                {msg}
              </span>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Yuklanmoqda...</p>
      ) : groups.length === 0 ? (
        <div className="empty">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-muted">
            <IconUsers size={20} />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">
            Hali guruh yo&apos;q
          </p>
          <p className="mt-1 text-sm text-muted">
            Botni guruhga admin qilib qo&apos;shing yoki Chat ID orqali
            qo&apos;shing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className={`card-pad ${g.active ? "" : "opacity-60"}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-ink">
                      {g.title}
                    </h3>
                    {g.isForum && <span className="badge">forum</span>}
                    {!g.active && (
                      <span className="badge badge-warn">nofaol</span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-faint">
                    <span>{categoryLabel(g.category)}</span>
                    <span>·</span>
                    <span className="font-mono">{g.chatId}</span>
                    {syncedAtLabel(g.memberCountUpdatedAt) && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <IconClock size={11} />
                          {syncedAtLabel(g.memberCountUpdatedAt)}
                        </span>
                      </>
                    )}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="badge badge-ink">
                      <IconUsers size={12} />
                      {g.memberCount ?? "—"} a&apos;zo
                    </span>
                    {g.botIsAdmin ? (
                      <span className="badge">
                        <IconShield size={12} />
                        Bot admin
                        {g.botCanDelete ? (
                          <>
                            <IconCheck size={12} /> o&apos;chirish
                          </>
                        ) : (
                          <>
                            <IconX size={12} /> o&apos;chirish
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="badge badge-warn">
                        <IconAlert size={12} />
                        Bot admin emas
                      </span>
                    )}
                  </div>
                  {!g.botIsAdmin && (
                    <p className="hint mt-2">
                      Kirdi/chiqdi xabarlari tozalanmaydi: botni guruhda admin
                      qiling (xabar o&apos;chirish huquqi bilan).
                    </p>
                  )}
                  {g.botIsAdmin && !g.botCanDelete && (
                    <p className="hint mt-2">
                      Bot admin, lekin <b>xabar o&apos;chirish</b> huquqi
                      yo&apos;q — kirdi/chiqdi tozalanmaydi.
                    </p>
                  )}
                  {g.topics.length > 0 && (
                    <p className="hint mt-2">
                      Mavzular: {g.topics.map((t) => t.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => refreshMeta(g.id)}
                    disabled={syncing}
                    title="A'zolar sonini Telegram'dan yangilash"
                    aria-label="A'zolar sonini yangilash"
                    className="btn btn-ghost btn-icon"
                  >
                    <IconRefresh size={16} />
                  </button>
                  <button
                    onClick={() => remove(g.id)}
                    title="Guruhni o'chirish"
                    aria-label="Guruhni o'chirish"
                    className="btn btn-danger btn-icon"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
                <select
                  value={g.category}
                  onChange={(e) => patch(g.id, { category: e.target.value })}
                  aria-label="Kategoriya"
                  className="input input-sm w-auto"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted transition-colors hover:text-ink">
                  <input
                    type="checkbox"
                    checked={g.cleanJoinLeave}
                    onChange={(e) =>
                      patch(g.id, { cleanJoinLeave: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  Kirdi/chiqdi tozalash
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted transition-colors hover:text-ink">
                  <input
                    type="checkbox"
                    checked={g.active}
                    onChange={(e) => patch(g.id, { active: e.target.checked })}
                    className="h-4 w-4"
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

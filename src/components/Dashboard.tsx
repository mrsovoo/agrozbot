"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  groups: number;
  agro: number;
  ferma: number;
  posts: number;
  cleaned: number;
  delivered: number;
  members: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Faol guruhlar", value: stats?.groups, icon: "👥", color: "from-emerald-500/20 to-emerald-500/5", text: "text-emerald-300" },
    { label: "Guruh a'zolari", value: stats?.members, icon: "👤", color: "from-teal-500/20 to-teal-500/5", text: "text-teal-300" },
    { label: "Agro dehqonchilik", value: stats?.agro, icon: "🌾", color: "from-lime-500/20 to-lime-500/5", text: "text-lime-300" },
    { label: "Ferma & chorvachilik", value: stats?.ferma, icon: "🐄", color: "from-amber-500/20 to-amber-500/5", text: "text-amber-300" },
    { label: "Jami postlar", value: stats?.posts, icon: "🗂", color: "from-sky-500/20 to-sky-500/5", text: "text-sky-300" },
    { label: "Yetkazilgan xabar", value: stats?.delivered, icon: "📤", color: "from-violet-500/20 to-violet-500/5", text: "text-violet-300" },
    { label: "Tozalangan xabar", value: stats?.cleaned, icon: "🧹", color: "from-rose-500/20 to-rose-500/5", text: "text-rose-300" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Boshqaruv paneli</h1>
          <p className="mt-1 text-sm text-slate-400">
            Guruhlaringiz va postlaringiz umumiy ko&apos;rinishi
          </p>
        </div>
        <Link
          href="/compose"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          ✍️ Yangi post yaratish
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border border-slate-800 bg-gradient-to-br ${c.color} p-5`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{c.icon}</span>
            </div>
            <p className={`mt-3 text-3xl font-bold ${c.text}`}>
              {c.value ?? "—"}
            </p>
            <p className="mt-1 text-sm text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/groups"
          className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-emerald-500/50"
        >
          <h3 className="text-lg font-semibold">👥 Guruhlarni boshqarish</h3>
          <p className="mt-2 text-sm text-slate-400">
            Guruhlarni kategoriyalarga ajrating (Agro / Ferma), kirdi-chiqdi
            tozalashni yoqing yoki o&apos;chiring.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-emerald-400 group-hover:underline">
            Ochish →
          </span>
        </Link>
        <Link
          href="/settings"
          className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-emerald-500/50"
        >
          <h3 className="text-lg font-semibold">⚙️ Botni ulash</h3>
          <p className="mt-2 text-sm text-slate-400">
            Bot tokenini tekshiring, webhook o&apos;rnating va botni guruhga
            qo&apos;shish bo&apos;yicha ko&apos;rsatmalarni ko&apos;ring.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-emerald-400 group-hover:underline">
            Sozlamalar →
          </span>
        </Link>
      </div>
    </div>
  );
}

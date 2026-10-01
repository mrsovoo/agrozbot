"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  IconArchive,
  IconBarn,
  IconCheck,
  IconChevronRight,
  IconCompose,
  IconGauge,
  IconLeaf,
  IconSend,
  IconSliders,
  IconUser,
  IconUsers,
} from "./icons";

type Stats = {
  groups: number;
  agro: number;
  ferma: number;
  posts: number;
  cleaned: number;
  delivered: number;
  members: number;
};

type Card = {
  label: string;
  value: number | undefined;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards: Card[] = [
    { label: "Faol guruhlar", value: stats?.groups, Icon: IconUsers },
    { label: "Guruh a'zolari", value: stats?.members, Icon: IconUser },
    { label: "Agro dehqonchilik", value: stats?.agro, Icon: IconLeaf },
    { label: "Ferma & chorvachilik", value: stats?.ferma, Icon: IconBarn },
    { label: "Jami postlar", value: stats?.posts, Icon: IconArchive },
    { label: "Yetkazilgan xabar", value: stats?.delivered, Icon: IconSend },
    { label: "Tozalangan xabar", value: stats?.cleaned, Icon: IconCheck },
  ];

  return (
    <div className="space-y-8">
      <header className="page-header">
        <div>
          <h1 className="page-title">Boshqaruv paneli</h1>
          <p className="page-sub">
            Guruhlaringiz va postlaringiz umumiy ko&apos;rinishi
          </p>
        </div>
        <Link href="/compose" className="btn btn-primary">
          <IconCompose size={17} />
          Yangi post
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {cards.map(({ label, value, Icon }) => (
          <div
            key={label}
            className="card-pad transition-colors hover:bg-subtle"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-subtle text-ink">
              <Icon size={17} />
            </span>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-ink">
              {value ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted sm:text-sm">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/groups"
          className="card group flex items-start gap-4 p-5 transition-colors hover:bg-subtle"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink">
            <IconUsers size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              Guruhlarni boshqarish
            </span>
            <span className="mt-1 block text-sm text-muted">
              Guruhlarni kategoriyalarga ajrating, a&apos;zolar sonini va
              kirdi/chiqdi tozalashni kuzatib boring.
            </span>
          </span>
          <IconChevronRight
            size={18}
            className="mt-2 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
          />
        </Link>

        <Link
          href="/settings"
          className="card group flex items-start gap-4 p-5 transition-colors hover:bg-subtle"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink">
            <IconSliders size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              Botni ulash
            </span>
            <span className="mt-1 block text-sm text-muted">
              Bot tokenini tekshiring, webhook o&apos;rnating va botni guruhga
              qo&apos;shish bo&apos;yicha ko&apos;rsatmalarni ko&apos;ring.
            </span>
          </span>
          <IconChevronRight
            size={18}
            className="mt-2 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      <p className="flex items-center gap-2 text-xs text-faint">
        <IconGauge size={14} />
        Statistika har bir sahifa yangilanganda bazadan qayta o&apos;qiladi.
      </p>
    </div>
  );
}

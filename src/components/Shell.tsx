import Link from "next/link";
import type { ReactNode } from "react";
import LogoutButton from "./LogoutButton";
import {
  IconArchive,
  IconCompose,
  IconGauge,
  IconLeaf,
  IconSliders,
  IconUsers,
} from "./icons";

const NAV = [
  { href: "/", label: "Boshqaruv paneli", Icon: IconGauge },
  { href: "/compose", label: "Yangi post", Icon: IconCompose },
  { href: "/groups", label: "Guruhlar", Icon: IconUsers },
  { href: "/posts", label: "Postlar tarixi", Icon: IconArchive },
  { href: "/settings", label: "Sozlamalar", Icon: IconSliders },
];

export default function Shell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Yon panel */}
      <aside className="sticky top-0 z-20 flex w-full shrink-0 flex-col border-b border-line bg-canvas/90 backdrop-blur lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-4 py-4 lg:px-5 lg:py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
            <IconLeaf size={19} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-ink">
              Agro &amp; Ferma
            </span>
            <span className="block text-[11px] text-muted">
              Bot admin panel
            </span>
          </span>
          {/* Mobil uchun chiqish tugmasi */}
          <span className="ml-auto lg:hidden">
            <LogoutButton compact />
          </span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === active ? "page" : undefined}
              className={`nav-item ${href === active ? "nav-item-active" : ""}`}
            >
              <Icon size={18} />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-line p-3 lg:block">
          <LogoutButton />
        </div>
      </aside>

      {/* Asosiy qism */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}

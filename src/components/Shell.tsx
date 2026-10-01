import Link from "next/link";
import type { ReactNode } from "react";
import LogoutButton from "./LogoutButton";

const NAV = [
  { href: "/", label: "Boshqaruv paneli", icon: "📊" },
  { href: "/compose", label: "Yangi post", icon: "✍️" },
  { href: "/groups", label: "Guruhlar", icon: "👥" },
  { href: "/posts", label: "Postlar tarixi", icon: "🗂" },
  { href: "/settings", label: "Sozlamalar", icon: "⚙️" },
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
      {/* Sidebar */}
      <aside className="flex w-full flex-col border-b border-slate-800 bg-slate-900/80 backdrop-blur lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-lime-500 text-lg">
            🌾
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Agro &amp; Ferma</p>
            <p className="text-xs text-slate-400">Bot admin panel</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {NAV.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden p-3 lg:block">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

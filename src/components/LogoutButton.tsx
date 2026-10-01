"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        await fetch("/api/auth/login", { method: "DELETE" });
        router.push("/login");
        router.refresh();
      }}
      className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:bg-rose-600 hover:text-white"
    >
      {loading ? "..." : "🚪 Chiqish"}
    </button>
  );
}

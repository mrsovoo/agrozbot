"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLogout } from "./icons";

export default function LogoutButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  if (compact) {
    return (
      <button
        onClick={logout}
        disabled={loading}
        title="Chiqish"
        aria-label="Chiqish"
        className="btn btn-ghost btn-icon"
      >
        <IconLogout size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="btn btn-ghost w-full justify-start"
    >
      <IconLogout size={18} />
      {loading ? "Chiqilmoqda..." : "Chiqish"}
    </button>
  );
}

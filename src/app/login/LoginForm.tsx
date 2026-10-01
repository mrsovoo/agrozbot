"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm({ showHint }: { showHint: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Xatolik");
    }
  }

  return (
    <form onSubmit={submit} className="card-pad space-y-4">
      <div>
        <label className="label mb-1.5">Parol</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="input"
          autoFocus
        />
      </div>
      {error && (
        <p className="alert-danger" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? "Tekshirilmoqda..." : "Kirish"}
      </button>
      {showHint && (
        <p className="alert-warn text-xs">
          ADMIN_PASSWORD o&apos;rnatilmagan. Boshlang&apos;ich parol:{" "}
          <code className="font-mono">admin123</code>
        </p>
      )}
    </form>
  );
}

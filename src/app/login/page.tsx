import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthed()) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-500 text-3xl">
            🌾
          </div>
          <h1 className="text-xl font-bold">Agro &amp; Ferma Admin</h1>
          <p className="mt-1 text-sm text-slate-400">
            Davom etish uchun parolni kiriting
          </p>
        </div>
        <LoginForm showHint={!process.env.ADMIN_PASSWORD} />
      </div>
    </div>
  );
}

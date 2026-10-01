import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import LoginForm from "./LoginForm";
import { IconLeaf } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthed()) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <IconLeaf size={26} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            Agro &amp; Ferma
          </h1>
          <p className="mt-1 text-sm text-muted">
            Davom etish uchun parolni kiriting
          </p>
        </div>
        <LoginForm showHint={!process.env.ADMIN_PASSWORD} />
      </div>
    </div>
  );
}

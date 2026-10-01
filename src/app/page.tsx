import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import Shell from "@/components/Shell";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await isAuthed())) redirect("/login");
  return (
    <Shell active="/">
      <Dashboard />
    </Shell>
  );
}

import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import Shell from "@/components/Shell";
import SettingsPanel from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await isAuthed())) redirect("/login");
  return (
    <Shell active="/settings">
      <SettingsPanel />
    </Shell>
  );
}

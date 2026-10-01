import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import Shell from "@/components/Shell";
import GroupsManager from "@/components/GroupsManager";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  if (!(await isAuthed())) redirect("/login");
  return (
    <Shell active="/groups">
      <GroupsManager />
    </Shell>
  );
}

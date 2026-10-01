import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import Shell from "@/components/Shell";
import Composer from "@/components/Composer";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  if (!(await isAuthed())) redirect("/login");
  return (
    <Shell active="/compose">
      <Composer />
    </Shell>
  );
}

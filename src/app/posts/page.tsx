import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import Shell from "@/components/Shell";
import PostsHistory from "@/components/PostsHistory";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  if (!(await isAuthed())) redirect("/login");
  return (
    <Shell active="/posts">
      <PostsHistory />
    </Shell>
  );
}

import { getDb, type Note } from "@/lib/db";
import NotesApp from "@/components/NotesApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const notes = (getDb().prepare("SELECT * FROM note ORDER BY pinned DESC, updated_at DESC").all() as Note[]).map((r) => ({ ...r }));
  return <NotesApp initial={notes} />;
}

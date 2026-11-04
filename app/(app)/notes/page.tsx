import { getDb, rows, type Note } from "@/lib/db";
import NotesApp from "@/components/NotesApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const notes = rows<Note>(getDb(), "SELECT * FROM note ORDER BY pinned DESC, updated_at DESC");
  return <NotesApp initial={notes} />;
}

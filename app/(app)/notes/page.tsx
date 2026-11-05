import { getDb, rows, type Note, type Task } from "@/lib/db";
import NotesApp from "@/components/NotesApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const notes = rows<Note>(db, "SELECT * FROM note ORDER BY pinned DESC, updated_at DESC");
  // 「所属项目」下拉 + 「关联任务」下拉要用
  const projects = rows<{ id: number; name: string }>(db, "SELECT id, name FROM project WHERE status <> 'archived' ORDER BY sort, id");
  const allTasks = rows<{ id: number; title: string; status: string }>(
    db,
    "SELECT id, title, status FROM task ORDER BY status='done', id DESC LIMIT 60"
  );
  return <NotesApp initial={notes} projects={projects} allTasks={allTasks} />;
}

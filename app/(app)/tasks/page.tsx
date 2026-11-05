import { getDb, rows, type Task } from "@/lib/db";
import TasksPage from "@/components/TasksPage";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const tasks = rows<Task>(db, "SELECT * FROM task ORDER BY sort, id");
  // 任务弹窗的「项目」下拉要这份列表
  const projects = rows<{ id: number; name: string; color: string }>(
    db,
    "SELECT id, name, color FROM project WHERE status <> 'archived' ORDER BY sort, id"
  );
  // 任务弹窗里「相关记录」下拉用
  const notes = rows<{ id: number; title: string }>(
    db,
    "SELECT id, title FROM note WHERE trim(title)<>'' OR trim(content)<>'' ORDER BY updated_at DESC LIMIT 60"
  );
  return <TasksPage initial={tasks} projectList={projects} noteList={notes} />;
}

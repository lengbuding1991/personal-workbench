import { getDb, rows, type Task } from "@/lib/db";
import TasksPage from "@/components/TasksPage";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const tasks = rows<Task>(db, "SELECT * FROM task ORDER BY sort, id");
  // 任务弹窗的「项目」下拉要这份列表
  const projects = rows<{ id: number; name: string }>(db, "SELECT id, name FROM project WHERE status <> 'archived' ORDER BY sort, id");
  return <TasksPage initial={tasks} projectList={projects} />;
}

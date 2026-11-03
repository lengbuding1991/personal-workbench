import { getDb, type Task } from "@/lib/db";
import TasksPage from "@/components/TasksPage";

export const dynamic = "force-dynamic";

export default function Page() {
  const tasks = (getDb().prepare("SELECT * FROM task ORDER BY sort, id").all() as Task[]).map((r) => ({ ...r }));
  return <TasksPage initial={tasks} />;
}

import { getDb, rows, type Task } from "@/lib/db";
import TasksPage from "@/components/TasksPage";

export const dynamic = "force-dynamic";

export default function Page() {
  const tasks = rows<Task>(getDb(), "SELECT * FROM task ORDER BY sort, id");
  return <TasksPage initial={tasks} />;
}

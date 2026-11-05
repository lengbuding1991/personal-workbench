import { format, startOfWeek, endOfWeek } from "date-fns";
import { getDb, rows, type Task, type Note } from "@/lib/db";
import ProjectsApp, { type Project } from "@/components/ProjectsApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const projects = rows<Project>(
    db,
    `SELECT p.*,
       (SELECT COUNT(*) FROM task t WHERE t.project_id = p.id) AS total,
       (SELECT COUNT(*) FROM task t WHERE t.project_id = p.id AND t.status='done') AS done
     FROM project p ORDER BY p.sort, p.id`
  );
  const tasks = rows<Task>(db, "SELECT * FROM task ORDER BY sort, id");
  // 项目页要显示「最近动静」和「本周完成」，所以把记录和本周完成数一起查出来
  const notes = rows<Pick<Note, "id" | "title" | "project_id" | "updated_at">>(
    db,
    "SELECT id, title, project_id, updated_at FROM note WHERE project_id IS NOT NULL ORDER BY updated_at DESC"
  );
  const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
  const we = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDoneByProject = new Map<number, number>();
  for (const t of tasks) {
    if (!t.project_id || t.status !== "done" || !t.done_at) continue;
    const d = t.done_at.slice(0, 10);
    if (d >= format(ws, "yyyy-MM-dd") && d <= format(we, "yyyy-MM-dd")) {
      weekDoneByProject.set(t.project_id, (weekDoneByProject.get(t.project_id) ?? 0) + 1);
    }
  }
  return (
    <ProjectsApp
      initial={projects}
      tasks={tasks}
      notes={notes}
      weekDone={Object.fromEntries(weekDoneByProject)}
    />
  );
}

import { getDb, rows, type Task } from "@/lib/db";
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
  return <ProjectsApp initial={projects} tasks={tasks} />;
}

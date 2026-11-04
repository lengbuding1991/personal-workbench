import { getDb, rows, type EventRow, type Task } from "@/lib/db";
import CalendarApp from "@/components/CalendarApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const events = rows<EventRow>(db, "SELECT * FROM event ORDER BY start_at");
  const tasks = rows<Task>(db, "SELECT * FROM task WHERE due_date IS NOT NULL ORDER BY due_date");
  return <CalendarApp events={events} tasks={tasks} />;
}

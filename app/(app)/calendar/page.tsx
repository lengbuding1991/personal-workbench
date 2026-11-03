import { getDb, type EventRow, type Task } from "@/lib/db";
import CalendarApp from "@/components/CalendarApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const events = (getDb().prepare("SELECT * FROM event ORDER BY start_at").all() as EventRow[]).map((r) => ({ ...r }));
  const tasks = (getDb().prepare("SELECT * FROM task WHERE due_date IS NOT NULL ORDER BY due_date").all() as Task[]).map((r) => ({ ...r }));
  return <CalendarApp events={events} tasks={tasks} />;
}

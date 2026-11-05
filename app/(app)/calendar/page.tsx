import { getDb, rows, type EventRow, type Task } from "@/lib/db";
import CalendarApp from "@/components/CalendarApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const events = rows<EventRow>(db, "SELECT * FROM event ORDER BY start_at");
  // due_date 和 scheduled_start 都要：截止日进「全天行」，安排了时间的进时间轴
  const tasks = rows<Task>(
    db,
    "SELECT * FROM task WHERE due_date IS NOT NULL OR scheduled_start IS NOT NULL ORDER BY due_date"
  );
  return <CalendarApp events={events} tasks={tasks} />;
}

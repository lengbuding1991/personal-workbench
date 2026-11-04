import { getDb, rows, type Task, type EventRow, type Note } from "@/lib/db";
import Dashboard from "@/components/Dashboard";
import { startOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const tasks = rows<Task>(db, "SELECT * FROM task ORDER BY sort, id");
  const events = rows<EventRow>(db, "SELECT * FROM event ORDER BY start_at");
  const notes = rows<Note>(
    db,
    "SELECT id,title,content,tags,created_at,updated_at FROM note WHERE archived=0 ORDER BY updated_at DESC LIMIT 60"
  );
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  return <Dashboard tasks={tasks} events={events} notes={notes} weekStart={weekStart} />;
}

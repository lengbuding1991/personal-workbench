import { getDb, type Task, type EventRow, type Note } from "@/lib/db";
import Dashboard from "@/components/Dashboard";
import { startOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const tasks = (db.prepare("SELECT * FROM task ORDER BY sort, id").all() as Task[]).map((r) => ({ ...r }));
  const events = (db.prepare("SELECT * FROM event ORDER BY start_at").all() as EventRow[]).map((r) => ({ ...r }));
  const notes = (db.prepare("SELECT id,title,content,tags,created_at,updated_at FROM note WHERE archived=0 ORDER BY updated_at DESC LIMIT 60").all() as Partial<Note>[]).map(
    (r) => ({ ...r })
  ) as Note[];
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  return <Dashboard tasks={tasks} events={events} notes={notes} weekStart={weekStart} />;
}

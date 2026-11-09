import { getDb, rows, type Task, type EventRow, type Note } from "@/lib/db";
import { loadHabits } from "@/lib/habits";
import { getSetting } from "@/lib/db";
import Dashboard from "@/components/Dashboard";
import { startOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const tasks = rows<Task>(db, "SELECT * FROM task ORDER BY sort, id");
  const events = rows<EventRow>(db, "SELECT * FROM event ORDER BY start_at");
  /* 灵感派要按「置顶 / 正文长度 / 有标签 / 新不新」打分，
     所以这些字段一个都不能少 */
  const notes = rows<Note>(
    db,
    "SELECT * FROM note WHERE archived=0 ORDER BY updated_at DESC LIMIT 60"
  );
  /* 习惯打卡：首页要显示「当前连续」和「历史最长」两个数 */
  const habitData = loadHabits(db);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  return (
    <Dashboard
      tasks={tasks}
      events={events}
      notes={notes}
      habits={habitData.habits}
      userName={getSetting("user_name", "Hina")}
      weekStart={weekStart}
    />
  );
}

import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import { getDb, rows, row, type Review, type Task, type Note } from "@/lib/db";
import { aiReady } from "@/lib/ai";
import ReviewApp from "@/components/ReviewApp";

/** 本周完成的任务明细（给复盘页列出来用） */
export type DoneTask = { id: number; title: string; done_at: string; area: string };

export const dynamic = "force-dynamic";

export default function Page() {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const ws = startOfWeek(now, { weekStartsOn: 1 });
  const we = endOfWeek(now, { weekStartsOn: 1 });
  const weekKey = format(ws, "yyyy-MM-dd");
  const db = getDb();
  const daily = row<Review>(db, "SELECT * FROM review WHERE date=? AND type='daily'", today) ?? null;
  const weekly = row<Review>(db, "SELECT * FROM review WHERE date=? AND type='weekly'", weekKey) ?? null;
  const history = rows<Review>(db, "SELECT * FROM review ORDER BY date DESC LIMIT 12");
  const tasks = rows<Task>(db, "SELECT * FROM task WHERE status='done'");
  // 只有「写了东西」的记录才算数：空记录（标题正文都空）不参与统计，
  // 否则点两次起步词就会虚增本周记录数。
  const notes = rows<Pick<Note, "id" | "updated_at">>(
    db,
    "SELECT id,updated_at FROM note WHERE trim(title)<>'' OR trim(content)<>''"
  );
  const weekDone = tasks.filter(
    (t) => t.done_at && isWithinInterval(parseISO(t.done_at), { start: ws, end: we })
  ) as DoneTask[];
  const doneThisWeek = weekDone.length;
  const notesThisWeek = notes.filter((n) => isWithinInterval(parseISO(n.updated_at), { start: ws, end: we })).length;
  return (
    <ReviewApp
      today={today}
      weeklyKey={weekKey}
      daily={daily}
      weekly={weekly}
      history={history}
      aiReady={aiReady()}
      doneThisWeek={doneThisWeek}
      notesThisWeek={notesThisWeek}
      weekDone={weekDone.map((t) => ({ id: t.id, title: t.title, done_at: t.done_at, area: t.area }))}
    />
  );
}

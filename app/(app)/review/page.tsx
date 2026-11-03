import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import { getDb, type Review, type Task, type Note } from "@/lib/db";
import { aiReady } from "@/lib/ai";
import ReviewApp from "@/components/ReviewApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const ws = startOfWeek(now, { weekStartsOn: 1 });
  const we = endOfWeek(now, { weekStartsOn: 1 });
  const weekKey = format(ws, "yyyy-MM-dd");
  const db = getDb();
  const daily = (db.prepare("SELECT * FROM review WHERE date=? AND type='daily'").get(today) as Review | undefined) ?? null;
  const weekly = (db.prepare("SELECT * FROM review WHERE date=? AND type='weekly'").get(weekKey) as Review | undefined) ?? null;
  const history = (db.prepare("SELECT * FROM review ORDER BY date DESC LIMIT 12").all() as Review[]).map((r) => ({ ...r }));
  const tasks = (db.prepare("SELECT * FROM task WHERE status='done'").all() as Task[]).map((r) => ({ ...r }));
  const notes = (db.prepare("SELECT id,updated_at FROM note").all() as Pick<Note, "id" | "updated_at">[]).map((r) => ({ ...r }));
  const doneThisWeek = tasks.filter((t) => t.done_at && isWithinInterval(parseISO(t.done_at), { start: ws, end: we })).length;
  const notesThisWeek = notes.filter((n) => isWithinInterval(parseISO(n.updated_at), { start: ws, end: we })).length;
  return (
    <ReviewApp
      today={today}
      weeklyKey={weekKey}
      daily={daily ? { ...daily } : null}
      weekly={weekly ? { ...weekly } : null}
      history={history}
      aiReady={aiReady()}
      doneThisWeek={doneThisWeek}
      notesThisWeek={notesThisWeek}
    />
  );
}

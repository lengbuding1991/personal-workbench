import { NextResponse } from "next/server";
import { addHours, format, parseISO } from "date-fns";
import { getDb, type EventRow, type Task } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const soon = addHours(now, 4).toISOString();
  const tasks = (db.prepare("SELECT * FROM task WHERE status != 'done' AND (due_date = ? OR (scheduled_start IS NOT NULL AND scheduled_start BETWEEN ? AND ?))").all(today, now.toISOString(), soon) as Task[]).map((t) => {
    const schedToday = t.scheduled_start && t.scheduled_start.slice(0, 10) === today;
    return {
      kind: "task" as const,
      id: t.id,
      title: t.title,
      at: schedToday ? (t.scheduled_start as string) : (t.due_date || t.scheduled_start || ""),
      priority: t.priority,
    };
  });
  const events = (db.prepare("SELECT * FROM event WHERE start_at BETWEEN ? AND ?").all(now.toISOString(), soon) as EventRow[]).map((e) => ({
    kind: "event" as const,
    id: e.id,
    title: e.title,
    at: e.start_at,
    priority: "med",
  }));
  const items = [...tasks, ...events]
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .slice(0, 20)
    .map((x) => ({ ...x, overdue: x.kind === "task" && x.at ? (x.at.slice(0, 10) < today || (x.at.includes("T") && parseISO(x.at) < now)) : false }));
  return NextResponse.json({ items });
}

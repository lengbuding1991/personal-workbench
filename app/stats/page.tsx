import { format, isSameDay, parseISO, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getDb, type Task, type Note } from "@/lib/db";
import StatsApp from "@/components/StatsApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const tasks = (db.prepare("SELECT * FROM task").all() as Task[]).map((r) => ({ ...r }));
  const notes = (db.prepare("SELECT * FROM note").all() as Note[]).map((r) => ({ ...r }));
  const reviews = db.prepare("SELECT date FROM review").all() as { date: string }[];
  const done = tasks.filter((t) => t.status === "done");
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
  const series = days.map((d) => ({
    label: format(d, "EEE", { locale: zhCN }),
    date: format(d, "MM/dd"),
    n: done.filter((t) => t.done_at && isSameDay(parseISO(t.done_at), d)).length,
  }));
  const areas = ["work", "side", "media", "study", "life"];
  const areaStats = areas.map((a) => ({
    area: a,
    total: tasks.filter((t) => t.area === a).length,
    done: tasks.filter((t) => t.area === a && t.status === "done").length,
  }));
  const activeDays = new Set(done.map((t) => t.done_at?.slice(0, 10)).filter(Boolean)).size;
  const recentDone = [...done]
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""))
    .slice(0, 6)
    .map((t) => ({ id: t.id, title: t.title, area: t.area, done_at: t.done_at }));
  const tagCount = new Map<string, number>();
  for (const n of notes) {
    for (const tg of (n.tags ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
      tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1);
    }
  }
  const tagStats = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, n]) => ({ tag, n }));

  return (
    <StatsApp
      total={tasks.length}
      done={done.length}
      notes={notes.length}
      reviews={reviews.length}
      activeDays={activeDays}
      series={series}
      areaStats={areaStats}
      recentDone={recentDone}
      tagStats={tagStats}
    />
  );
}

import { format, isSameDay, parseISO, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getDb, rows, type Task, type Note } from "@/lib/db";
import StatsApp from "@/components/StatsApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const tasks = rows<Task>(db, "SELECT * FROM task");
  const notes = rows<Note>(db, "SELECT * FROM note");
  const reviews = rows<{ date: string }>(db, "SELECT date FROM review");
  const projectRows = rows<{ id: number; name: string; color: string }>(db, "SELECT id,name,color FROM project ORDER BY sort, id");

  const done = tasks.filter((t) => t.status === "done");
  const today = new Date();

  /* 近 7 天 */
  const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
  const series = days.map((d) => ({
    label: format(d, "EEE", { locale: zhCN }),
    date: format(d, "MM/dd"),
    n: done.filter((t) => t.done_at && isSameDay(parseISO(t.done_at), d)).length,
  }));

  /* 近 30 天：每隔 5 天取一个点，避免柱子太密看不清 */
  const series30 = Array.from({ length: 30 }, (_, i) => subDays(today, 29 - i)).map((d) => ({
    date: format(d, "MM/dd"),
    n: done.filter((t) => t.done_at && isSameDay(parseISO(t.done_at), d)).length,
  }));

  /*
   * 热力图：近 26 周（182 天）。
   * 为什么是 26 周而不是 53 周：手机上 53 列 × 每列 12px 宽 = 636px，横着塞不下。
   * 半年已经足够看出「哪段时间在持续做事、哪段时间断了」。
   */
  const heatDays = Array.from({ length: 182 }, (_, i) => subDays(today, 181 - i)).map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const n = done.filter((t) => t.done_at && t.done_at.slice(0, 10) === key).length;
    const wroteNote = notes.some((x) => x.updated_at.slice(0, 10) === key);
    return { date: key, n, note: wroteNote };
  });

  const areas = ["work", "side", "media", "study", "life"];
  const areaStats = areas.map((a) => ({
    area: a,
    total: tasks.filter((t) => t.area === a).length,
    done: tasks.filter((t) => t.area === a && t.status === "done").length,
  }));

  /* 项目对比：只列有任务的项目 */
  const projectStats = projectRows
    .map((p) => {
      const mine = tasks.filter((t) => t.project_id === p.id);
      return { id: p.id, name: p.name, color: p.color, total: mine.length, done: mine.filter((t) => t.status === "done").length };
    })
    .filter((p) => p.total > 0);

  const activeDays = new Set(done.map((t) => t.done_at?.slice(0, 10)).filter(Boolean)).size;

  /* 连续天数：从今天往回数，有完成记录就继续 */
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const key = format(subDays(today, i), "yyyy-MM-dd");
    if (done.some((t) => t.done_at?.slice(0, 10) === key)) streak++;
    else if (i > 0) break;
    else continue; // 今天还没做不算断
  }

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
      streak={streak}
      series={series}
      series30={series30}
      heatDays={heatDays}
      areaStats={areaStats}
      projectStats={projectStats}
      recentDone={recentDone}
      tagStats={tagStats}
    />
  );
}

import { NextResponse } from "next/server";
import { addMinutes, format, parseISO, subMinutes } from "date-fns";
import { getDb, rows, type EventRow, type Task } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { expandEvents } from "@/lib/repeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 待提醒列表。
 *
 * 这里统一用「本地时间字符串」（yyyy-MM-ddTHH:mm）比较，不用 toISOString()。
 * 原因：数据库里 start_at / due_date 存的是本地墙上时间，拿 UTC 的 ISO 串
 * 去比会差 8 小时，凌晨附近直接比错（改之前就是这么错的）。
 *
 * 三类都会列出来：
 *   1. 逾期没做的任务
 *   2. 今天到期、或 12 小时内要做的
 *   3. 到了提醒点的（按各自 remind_min 提前量算）
 */
export async function GET() {
  const gate = await requireAuth();
  if (gate) return gate;

  const db = getDb();
  const now = new Date();
  const nowStr = format(now, "yyyy-MM-dd'T'HH:mm");
  const today = format(now, "yyyy-MM-dd");
  // 往后看 12 小时就够，再多列表也没人看
  const horizon = format(addMinutes(now, 12 * 60), "yyyy-MM-dd'T'HH:mm");

  const tasks = rows<Task>(db, "SELECT * FROM task WHERE status <> 'done'");
  const events = rows<EventRow>(db, "SELECT * FROM event");

  type Item = {
    kind: "task" | "event";
    id: number;
    title: string;
    at: string;
    priority: string;
    overdue?: boolean;
    /** 该提醒的时间点（任务/日程时间往前推 remind_min） */
    remindAt?: string;
  };

  const items: Item[] = [];

  for (const t of tasks) {
    const at = (t.scheduled_start || t.due_date || "").slice(0, 16);
    if (!at) continue;
    const hasTime = at.length > 10;

    // 逾期：有具体时间的比 nowStr，只有日期的比 today
    const overdue = hasTime ? at < nowStr : at < today;

    let remindAt: string | undefined;
    if (hasTime && t.remind_min !== null && t.remind_min !== undefined) {
      remindAt = format(subMinutes(parseISO(at), t.remind_min), "yyyy-MM-dd'T'HH:mm");
    }

    const todayDue = at.slice(0, 10) === today;
    const within = hasTime && at >= nowStr && at <= horizon;
    const remindDue = remindAt ? remindAt <= nowStr : false;

    if (!overdue && !todayDue && !within && !remindDue) continue;
    // 只有日期没有时间的，只在「今天」这一天列出来
    if (!hasTime && !todayDue) continue;

    items.push({
      kind: "task",
      id: t.id,
      title: t.title,
      at,
      priority: t.priority,
      overdue,
      remindAt,
    });
  }

  // 日程：带重复的先展开，否则「每天 9:30 的站会」明天就提醒不到了
  const shownEvents = expandEvents(events, now, addMinutes(now, 24 * 60));
  const seen = new Set<number>();
  for (const e of shownEvents) {
    const at = e.start_at.slice(0, 16);
    if (!at || at < nowStr) continue; // 过去的日程不再提醒
    if (at > horizon) continue;
    if (seen.has(e.id)) continue; // 重复展开会给出同一个 id 的多份，只提醒最近的一次
    seen.add(e.id);

    let remindAt: string | undefined;
    if (e.remind_min !== null && e.remind_min !== undefined) {
      remindAt = format(subMinutes(parseISO(at), e.remind_min), "yyyy-MM-dd'T'HH:mm");
    }
    items.push({
      kind: "event",
      id: e.id,
      title: e.title,
      at,
      priority: "med",
      remindAt,
    });
  }

  items.sort((a, b) => {
    // 逾期的排最前，然后按时间
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.at < b.at ? -1 : 1;
  });

  return NextResponse.json({ items: items.slice(0, 30), now: nowStr });
}

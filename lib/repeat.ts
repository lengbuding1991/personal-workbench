import { addDays, addMonths, format, isAfter, isBefore, parseISO, startOfDay } from "date-fns";

/**
 * 重复规则。
 *
 * 两种处理方式的区别很关键，别搞混：
 *
 * · 日程（event）用「虚拟展开」——库里只存一条基准记录，日历渲染时
 *   按规则临时算出区间内的每一次。这样改一条规则就等于改了一串，
 *   也不会因为展开几年而把库撑大。
 *
 * · 任务（task）用「完成后生成下一次」——勾完这一条，服务端把
 *   日期往后推一格另存一条新的。任务有「完成」这个状态，
 *   虚拟展开会让同一件事在列表里出现十几次，反而乱。
 */

export const RULES = ["none", "daily", "weekdays", "weekly", "monthly"] as const;
export type RepeatRule = (typeof RULES)[number];

export const ruleLabel: Record<string, string> = {
  none: "不重复",
  daily: "每天",
  weekdays: "每个工作日",
  weekly: "每周",
  monthly: "每月",
};

/** 把 base 往后推一格。weekdays 会跳过周六周日。 */
export function advance(date: Date, rule: string): Date {
  switch (rule) {
    case "daily":
      return addDays(date, 1);
    case "weekdays": {
      let d = addDays(date, 1);
      while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
      return d;
    }
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonths(date, 1);
    default:
      return date;
  }
}

/**
 * 把带重复规则的日程展开成区间内的每一条。
 *
 * 上限 400 次迭代：防止「每天重复 + 起始日 1990 年」这种数据把请求拖死。
 * 超出上限就截断，反正用户也看不完。
 */
export function expandEvents<T extends { start_at: string; repeat_rule?: string | null; end_at?: string | null }>(
  list: T[],
  from: Date,
  to: Date
): T[] {
  const out: T[] = [];
  const lo = startOfDay(from);
  const hi = startOfDay(to);

  for (const ev of list) {
    const rule = ev.repeat_rule || "none";
    if (rule === "none") {
      out.push(ev);
      continue;
    }

    let start = parseISO(ev.start_at);
    if (!start || Number.isNaN(start.getTime())) {
      out.push(ev);
      continue;
    }

    // 跳过区间之前的所有次，但保留时长
    const durMs = ev.end_at ? parseISO(ev.end_at).getTime() - start.getTime() : 0;
    let guard = 0;
    while (isBefore(start, lo) && guard++ < 400) start = advance(start, rule);

    guard = 0;
    while (!isAfter(start, hi) && guard++ < 400) {
      const s = format(start, "yyyy-MM-dd'T'HH:mm");
      const e = ev.end_at ? format(new Date(start.getTime() + durMs), "yyyy-MM-dd'T'HH:mm") : null;
      out.push({ ...ev, start_at: s, end_at: e });
      start = advance(start, rule);
    }
  }
  return out;
}

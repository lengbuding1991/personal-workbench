import type { DatabaseSync } from "node:sqlite";
import { format, parseISO, subDays } from "date-fns";
import { rows } from "@/lib/db";

export type Habit = {
  id: number;
  name: string;
  color: string;
  sort: number;
  archived: number;
  created_at: string;
};

export type HabitView = Habit & {
  /** 最近 60 天里打过卡的日期（旧→新） */
  logs: string[];
  /** 当前连续天数 */
  streak: number;
  doneToday: boolean;
  /** 最近 7 天完成了几天 */
  weekDone: number;
};

/** 只回看 60 天：习惯的意义在最近，查全表没意义 */
export const LOOKBACK = 60;

export function dayKey(d: Date = new Date()) {
  return format(d, "yyyy-MM-dd");
}

/** 最近 n 天的日期，旧→新，最后一个是今天 */
export function lastDays(n: number, end: Date = new Date()) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(format(subDays(end, i), "yyyy-MM-dd"));
  return out;
}

export function prevDay(key: string) {
  return format(subDays(parseISO(key), 1), "yyyy-MM-dd");
}

/**
 * 连续天数。
 *
 * 今天还没打卡时从昨天往前数 —— 否则零点一过连续天数就「归零」，
 * 用户会以为记录丢了。中间断一天就停，不做宽容。
 */
export function computeStreak(dates: Set<string>, today: string) {
  let cursor = dates.has(today) ? today : prevDay(today);
  let n = 0;
  while (dates.has(cursor)) {
    n += 1;
    cursor = prevDay(cursor);
  }
  return n;
}

/** 一次查齐所有习惯 + 最近 60 天打卡，页面和接口共用 */
export function loadHabits(db: DatabaseSync) {
  const today = dayKey();
  const since = format(subDays(new Date(), LOOKBACK - 1), "yyyy-MM-dd");
  const list = rows<Habit>(db, "SELECT * FROM habit WHERE archived = 0 ORDER BY sort, id");
  const logs = rows<{ habit_id: number; date: string }>(
    db,
    "SELECT habit_id, date FROM habit_log WHERE date >= ? ORDER BY date",
    since,
  );

  const byHabit = new Map<number, Set<string>>();
  for (const l of logs) {
    let set = byHabit.get(l.habit_id);
    if (!set) byHabit.set(l.habit_id, (set = new Set()));
    set.add(l.date);
  }

  const week = lastDays(7);
  const habits: HabitView[] = list.map((h) => {
    const set = byHabit.get(h.id) ?? new Set<string>();
    return {
      ...h,
      logs: [...set].sort(),
      streak: computeStreak(set, today),
      doneToday: set.has(today),
      weekDone: week.filter((d) => set.has(d)).length,
    };
  });

  return { today, days: week, habits };
}

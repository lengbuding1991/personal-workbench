import type { DatabaseSync } from "node:sqlite";
import { format, subDays } from "date-fns";
import { rows } from "@/lib/db";
import { computeBestStreak, computeStreak, dayKey, lastDays } from "@/lib/dates";

/* 纯日期算法放在 lib/dates.ts（客户端组件也要用），这里转出去给服务端引用 */
export { dayKey, lastDays, computeStreak, computeBestStreak } from "@/lib/dates";

export type Habit = {
  id: number;
  name: string;
  color: string;
  sort: number;
  archived: number;
  created_at: string;
};

export type HabitView = Habit & {
  /** 回看窗口内打过卡的日期（旧→新） */
  logs: string[];
  /** 当前连续天数（断了会归零） */
  streak: number;
  /** 历史最长连续天数（成就，不会归零） */
  bestStreak: number;
  doneToday: boolean;
  /** 本周（周一→周日）完成了几天 */
  weekDone: number;
};

/**
 * 回看窗口。
 *
 * 60 天是拍脑袋定的，鸿蒙端改成了 365 天 —— 因为要算「历史最长连续」，
 * 窗口太短就永远算不出真正的成就（一个人半年前连了 40 天，60 天窗口里看不见）。
 */
export const LOOKBACK = 365;

/** 补卡网格一次展示多少天 */
export const BACKFILL_DAYS = 30;

/** 一次查齐所有习惯 + 回看窗口内的打卡，页面和接口共用 */
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

  // 本周窗口必须和圆点画的那一周同源，
  // 否则会出现「本周 3/7」但圆点只亮 1 个。
  const week = lastDays(7);
  const habits: HabitView[] = list.map((h) => {
    const set = byHabit.get(h.id) ?? new Set<string>();
    const dates = [...set].sort();
    return {
      ...h,
      logs: dates,
      streak: computeStreak(set, today),
      bestStreak: computeBestStreak(dates),
      doneToday: set.has(today),
      weekDone: week.filter((d) => set.has(d)).length,
    };
  });

  return { today, days: week, habits };
}

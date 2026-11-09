/**
 * 日期小工具。
 *
 * 单独一个文件是因为 `lib/habits.ts` 里 import 了 node:sqlite，
 * 客户端组件不能引它；但习惯页的乐观更新要在浏览器里重算连续天数。
 * 所以纯日期算法放这里，两边共用一份。
 */
import { format, parseISO, subDays } from "date-fns";

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

/**
 * 历史最长连续天数。
 *
 * 和 streak 不同：这是成就，断掉也不会归零。
 * 把所有打卡日期排序后扫一遍，遇到连续的就累加，中断就重新数。
 */
export function computeBestStreak(dates: string[]) {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    /* sorted[i-1] 是不是正好是 sorted[i] 的前一天？
       prevDay(sorted[i]) = sorted[i] - 1 天，要和 sorted[i-1] 比 */
    if (prevDay(sorted[i]) === sorted[i - 1]) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

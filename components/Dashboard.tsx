"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, differenceInCalendarDays, endOfMonth, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  ListTodo,
  NotebookPen,
  Plus,
  Quote,
  RotateCcw,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  User,
  Wand2,
  ChartNoAxesColumn,
} from "lucide-react";
import type { Task, EventRow, Note, Area } from "@/lib/db";
import type { HabitView } from "@/lib/habits";
import { useTasks } from "@/lib/use-tasks";
import TaskModal from "./TaskModal";
import TopBar from "./TopBar";
import Select from "./Select";

const areaMeta: Record<Area, { label: string; cls: string; hex: string }> = {
  work: { label: "工作", cls: "sky", hex: "#5AA7E8" },
  side: { label: "副业", cls: "lav", hex: "#A78BFA" },
  media: { label: "自媒体", cls: "peach", hex: "#F5AE8E" },
  study: { label: "学习", cls: "mint", hex: "#6FD6BE" },
  life: { label: "生活", cls: "amber", hex: "#F6C453" },
};

const catStyle: Record<Area, { bg: string; color: string }> = {
  work: { bg: "#E8F2FC", color: "#2F7FC4" },
  side: { bg: "#F1ECFE", color: "#7C5CE0" },
  media: { bg: "#FCEAF2", color: "#C25E8C" },
  study: { bg: "#E3F8F2", color: "#2E8C77" },
  life: { bg: "#FDF4DC", color: "#A97C1B" },
};

const modules = [
  { href: "/tasks", label: "任务面板", sub: "计划与打卡", icon: ListTodo, bg: "#E8F2FC", fg: "#2F7FC4" },
  { href: "/calendar", label: "日历安排", sub: "日程与时间块", icon: CalendarDays, bg: "#E3F8F2", fg: "#2E8C77" },
  { href: "/notes", label: "记录灵感", sub: "随手写下想法", icon: NotebookPen, bg: "#FCEAF2", fg: "#C25E8C" },
  { href: "/review", label: "每日复盘", sub: "回顾与调整", icon: RotateCcw, bg: "#F1ECFE", fg: "#7C5CE0" },
  { href: "/ai", label: "AI 助手", sub: "拆任务、起稿", icon: Wand2, bg: "#FDF4DC", fg: "#A97C1B" },
  { href: "/stats", label: "数据洞察", sub: "趋势与投入", icon: ChartNoAxesColumn, bg: "#E9F3FB", fg: "#3D7BA6" },
  { href: "/search", label: "全局搜索", sub: "找任何一条", icon: TrendingUp, bg: "#E1F7F5", fg: "#1F9E9A" },
  { href: "/settings", label: "偏好设置", sub: "本地与 AI", icon: Settings, bg: "#F0F4F8", fg: "#6A7F92" },
];

export default function Dashboard({
  tasks: tasksProp,
  events,
  notes,
  habits = [],
  userName = "",
  weekStart,
}: {
  tasks: Task[];
  events: EventRow[];
  notes: Note[];
  habits: HabitView[];
  userName: string;
  weekStart: string;
}) {
  const router = useRouter();
  const { tasks, cycle } = useTasks(tasksProp);
  const [mode, setMode] = useState<"plan" | "inspire">("plan");
  const [trendRange, setTrendRange] = useState<"this" | "last">("this");
  const [investRange, setInvestRange] = useState<"week" | "month">("week");
  const [modal, setModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [weekOffset, setWeekOffset] = useState(0);
  /* 选中本周某一天（-1 = 看整周）—— 点日期头就能只看那天 */
  const [dayPick, setDayPick] = useState(-1);
  const [spin, setSpin] = useState(0);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));

  const now = new Date();
  const ws = addDays(parseISO(weekStart), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const todayAll = tasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), now));
  const todayOpen = todayAll.filter((t) => t.status !== "done");
  const todayDone = todayAll.filter((t) => t.status === "done");
  const todayPct = todayAll.length ? Math.round((todayDone.length / todayAll.length) * 100) : 0;

  /* 「完成率」按全部任务算，不按今天算。
     以前只看今天到期的任务：今天没写截止日，完成率就永远是 0，
     看久了会以为自己一件都没做成。长期任务没做完就一直欠着，
     写了这天又没做完的照样算逾期（任务面板里标红）。 */
  const allPct = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const yesterday = subDays(now, 1);
  const yAll = tasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), yesterday));
  const yDone = yAll.filter((t) => t.status === "done");
  const yPct = yAll.length ? Math.round((yDone.length / yAll.length) * 100) : 0;

  const doneDays = new Set(doneTasks.map((t) => (t.done_at ? t.done_at.slice(0, 10) : "")).filter(Boolean));
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = format(subDays(now, i), "yyyy-MM-dd");
    if (doneDays.has(d)) streak += 1;
    else if (i === 0) continue;
    else break;
  }

  /* 习惯打卡：大数字 = 当前连续的最大值（今天还没打卡也不打断），
     另外算历史最长（成就，断掉不归零）—— 这两个数不是一回事 */
  const habitStreak = habits.reduce((n, h) => Math.max(n, h.streak), 0);
  const habitBest = habits.reduce((n, h) => Math.max(n, h.bestStreak), 0);
  const habitPending = habits.filter((h) => !h.doneToday).length;
  const habitPct = habits.length
    ? Math.round(((habits.length - habitPending) / habits.length) * 100)
    : 0;

  const weekDone = doneTasks.filter((t) => t.done_at && parseISO(t.done_at) >= startOfWeek(now, { weekStartsOn: 1 }));
  const focusMin = weekDone.reduce((n, t) => n + (t.estimate_min ?? 20), 0);
  const focusH = (focusMin / 60).toFixed(1);
  const points = doneTasks.length * 10 + notes.length * 2;

  const trend = useMemo(() => {
    // 选「上周」时整体往前推 7 天
    const end = trendRange === "last" ? subDays(now, 7) : now;
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(end, 6 - i);
      const mins = doneTasks
        .filter((t) => t.done_at && isSameDay(parseISO(t.done_at), d))
        .reduce((n, t) => n + (t.estimate_min ?? 20), 0);
      return { d, v: Math.round((mins / 60) * 10) / 10 };
    });
  }, [doneTasks, now, trendRange]);

  const weekTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.scheduled_start) return false;
        const s = parseISO(t.scheduled_start);
        return s >= ws && s < addDays(ws, 7);
      }),
    [tasks, ws]
  );

  /* 本周安排要同时画「任务」和「日程」——
     卡片上写「N 件安排」是任务 + 日程，甘特条只画任务的话两边对不上，
     而且点某天看到的日程在条上根本找不到。 */
  const weekEvents = useMemo(
    () =>
      events.filter((e) => {
        const s = parseISO(e.start_at);
        return s >= ws && s < addDays(ws, 7);
      }),
    [events, ws],
  );

  type LaneItem = {
    key: string;
    title: string;
    startIdx: number;
    endIdx: number;
    kind: "task" | "event";
    task?: Task;
    event?: EventRow;
    color: string;
  };

  const lanes = useMemo(() => {
    const idx = (a: Date, b: Date) => {
      const d = differenceInCalendarDays(a, ws);
      return Math.max(0, Math.min(6, d));
    };
    const items: LaneItem[] = [
      ...weekTasks.map((t) => {
        const s = parseISO(t.scheduled_start as string);
        const e = t.scheduled_end ? parseISO(t.scheduled_end) : s;
        const startIdx = idx(s, ws);
        return {
          key: `t${t.id}`,
          title: t.title,
          startIdx,
          endIdx: Math.max(startIdx, idx(e, ws)),
          kind: "task" as const,
          task: t,
          color: areaMeta[t.area].hex,
        };
      }),
      ...weekEvents.map((e) => {
        const s = parseISO(e.start_at);
        const en = e.end_at ? parseISO(e.end_at) : s;
        const startIdx = idx(s, ws);
        return {
          key: `e${e.id}`,
          title: e.title,
          startIdx,
          endIdx: Math.max(startIdx, idx(en, ws)),
          kind: "event" as const,
          event: e,
          color: "#A78BFA",
        };
      }),
    ].sort((a, b) => a.startIdx - b.startIdx);
    const rows: LaneItem[][] = [];
    for (const it of items) {
      const lane = rows.find((r) => r[r.length - 1].endIdx < it.startIdx);
      if (lane) lane.push(it);
      else rows.push([it]);
    }
    return rows;
  }, [weekTasks, weekEvents, ws]);

  const invest = useMemo(() => {
    const map = new Map<Area, number>();
    /*
     * 「本周」用 ws..ws+7 的已排期任务；
     * 「本月」改成整月，这样切过去数字会真的变，而不是一个摆设。
     */
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const source =
      investRange === "month"
        ? tasks.filter((t) => {
            if (!t.scheduled_start) return false;
            const d = parseISO(t.scheduled_start);
            return d >= monthStart && d <= monthEnd;
          })
        : weekTasks;
    for (const t of source) {
      const s = parseISO(t.scheduled_start as string);
      const e = t.scheduled_end ? parseISO(t.scheduled_end) : s;
      const h = Math.max(0.5, differenceInCalendarDays(e, s) + 1);
      map.set(t.area, (map.get(t.area) ?? 0) + h);
    }
    if (map.size === 0) for (const t of openTasks) map.set(t.area, (map.get(t.area) ?? 0) + 1);
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([area, v]) => ({ area, v, pct: Math.round((v / total) * 100), ...areaMeta[area] }));
  }, [weekTasks, openTasks, tasks, investRange]);

  const investTotal = invest.reduce((n, x) => n + x.v, 0);
  const donutBg = useMemo(() => {
    let acc = 0;
    const stops = invest.map((c) => {
      const from = acc;
      acc += c.pct;
      return `${c.hex} ${from}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(",") || "#E8F2FC 0 100%"})`;
  }, [invest]);

  const quoteNote = notes.find((n) => n.content && n.content.trim().length > 8);

  /* 灵感派：显示「记录灵感」里写下的内容，不是待办任务。
     评分规则跟鸿蒙端对齐：置顶 +3、正文够长 +1、有标签 +1、
     今天/昨天刚记的 +2、最近一周记的 +1。 */
  const candidates = useMemo(() => {
    const quoteId = quoteNote?.id ?? -1;
    const scored = notes
      .filter((n) => n.id !== quoteId)
      .map((n) => {
        let s = 1;
        if (n.pinned === 1) s += 3;
        if ((n.content || "").trim().length > 20) s += 1;
        if ((n.tags || "").trim()) s += 1;
        const days = n.updated_at ? differenceInCalendarDays(now, parseISO(n.updated_at)) : 999;
        if (days <= 1) s += 2;
        else if (days <= 7) s += 1;
        return { n, s };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 5);
    const sum = scored.reduce((n, x) => n + x.s, 0) || 1;
    /* 「换一批」：把整份列表轮转一个位置，而不是换一批随机内容 */
    const rotated = scored.map((_, i) => scored[(i + spin) % scored.length]);
    return rotated.map((x, i) => ({
      ...x,
      pct: Math.round((x.s / sum) * 100),
      color: ["#3AC8C2", "#5AA7E8", "#A78BFA", "#F5AE8E", "#F6C453"][i % 5],
    }));
  }, [notes, now, spin]);

  const nudgeDonut = useMemo(() => {
    let acc = 0;
    const stops = candidates.map((c) => {
      const from = acc;
      acc += c.pct;
      return `${c.color} ${from}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(",") || "#E8F2FC 0 100%"})`;
  }, [candidates]);

  /* 「最近任务」只放还没做完的 —— 完成了的任务挤在首页最没用，
     而且会把真正要做的挤下去。取最近 5 条。 */
  const recent = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => {
        const rank = (t: Task) => (t.status === "doing" ? 0 : 1);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
      })
      .slice(0, 5);
  }, [tasks]);

  const calDays = useMemo(() => {
    const first = startOfMonth(calMonth);
    const startWeekday = (first.getDay() + 6) % 7;
    const cells: { d: Date; out: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ d: addDays(first, i - startWeekday), out: true });
    const total = differenceInCalendarDays(endOfMonth(calMonth), first) + 1;
    for (let i = 0; i < total; i++) cells.push({ d: addDays(first, i), out: false });
    while (cells.length % 7) cells.push({ d: addDays(first, total + (cells.length % 7)), out: true });
    return cells;
  }, [calMonth]);

  const tasksOn = (d: Date) =>
    tasks.some((t) => (t.due_date && isSameDay(parseISO(t.due_date), d)) || (t.scheduled_start && isSameDay(parseISO(t.scheduled_start), d)));

  /* 每天完成了多少件 —— 月历格子上显示数字，
     只显示「有/没有」看不出这一天到底做了多少 */
  /* 本月完成数：只看这个月的，不是历史总数 */
  const monthDoneCount = useMemo(() => {
    const ym = format(calMonth, "yyyy-MM");
    return doneTasks.filter((t) => t.done_at && t.done_at.slice(0, 7) === ym).length;
  }, [doneTasks, calMonth]);

  const doneCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== "done" || !t.done_at) continue;
      const key = t.done_at.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [tasks]);
  const dayKeyOf = (d: Date) => format(d, "yyyy-MM-dd");

  const trendMax = Math.max(...trend.map((t) => t.v));
  const trendTop = Math.max(1, Math.round(trendMax * 1.45 * 10) / 10);
  const CW = 1000;
  const CH = 172;
  const PADX = 52;
  const BASE = 138;
  const TOP = 24;
  const pts = trend.map((t, i) => ({
    x: PADX + (i * (CW - PADX * 2)) / 6,
    y: BASE - (t.v / trendTop) * (BASE - TOP),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)} ${BASE} L${pts[0].x.toFixed(1)} ${BASE} Z`;

  const topArea = invest[0]?.label ?? "任务";
  const summaryText = `本周你在${invest
    .slice(0, 3)
    .map((i) => i.label)
    .join("、")}上投入较多，完成 ${weekDone.length} 件、记录 ${notes.length} 条。${
    todayPct >= yPct ? "完成率比昨天更稳，保持这个节奏。" : "节奏比昨天松一点，先挑一件最小的事启动。"
  }`;

  return (
    <>
      <TopBar crumb="成长总览">
        <button className="primary" onClick={() => setModal({ open: true, task: null })}>
          <Plus size={12} /> 添加任务
        </button>
      </TopBar>

      <div className="hello">
        <div>
          <div className="eyebrow hello-eyebrow">
            <span>{format(now, "yyyy.MM.dd")} · {format(now, "EEEE", { locale: zhCN })}</span>
            {/* 右上角显示设置里的「称呼」—— 改了称呼要能一眼看到，
                不然用户会以为设置没生效 */}
            {userName && (
              <Link href="/settings" className="name-chip" title="在设置里改称呼">
                <User size={11} />
                {userName}
              </Link>
            )}
          </div>
          <h1>今天，先做三件要紧事。</h1>
          <p>其余都是加分项。今天还有 {todayOpen.length || openTasks.length} 件待办。</p>
        </div>
        <div className="card score">
          <div className="ring" style={{ background: `conic-gradient(#3AC8C2 0 ${todayPct}%, #E8F1F8 ${todayPct}% 100%)` }}>
            <b>{todayPct}%</b>
          </div>
          <div>
            <div className="k">今日完成度</div>
            <div className="s">已完成 {todayDone.length} / {todayAll.length || 0} 项</div>
          </div>
        </div>
      </div>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: "#E8F2FC", color: "#2F7FC4" }}><ListTodo size={15} /></span>
            今日任务
          </div>
          <b>{todayAll.length || openTasks.length}<small>项</small></b>
          <div className="d mute">
            {todayAll.length
              ? `今天到期 ${todayAll.length} 项 · 已完成 ${todayDone.length} 项`
              : `待办 ${openTasks.length} 项 · 全部任务 ${tasks.length} 项`}
          </div>
          <div className="track"><i style={{ width: `${todayPct}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: "#E3F8F2", color: "#2E8C77" }}><CheckCircle2 size={15} /></span>
            完成率
          </div>
          <b>{allPct}%</b>
          <div className="d mute">
            {tasks.length === 0
              ? "还没有任务"
              : openTasks.length > 0
                ? `已完成 ${doneTasks.length} / ${tasks.length} 件 · 还剩 ${openTasks.length} 件`
                : `已完成 ${doneTasks.length} / ${tasks.length} 件 · 全部做完了`}
          </div>
          <div className="track"><i style={{ width: `${allPct}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: "#FDEEE6", color: "#C2622F" }}><Flame size={15} /></span>
            连续完成
          </div>
          <b>{streak}<small>天</small></b>
          {/* 「连续完成」= 连续每天都有任务完成；和下面的「习惯打卡」不是一回事，
              所以这里明确写清楚，免得两个火苗数字打架 */}
          <div className="d mute" title="连续每天都有任务完成的天数。和「习惯打卡」不是一回事">
            每天都有任务完成 · 累计 {doneTasks.length} 件
          </div>
          <div className="track"><i style={{ width: `${Math.min(100, streak * 6)}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: "#E9F3FB", color: "#3D7BA6" }}><Clock3 size={15} /></span>
            专注时长
          </div>
          <b>{focusH}<small>小时</small></b>
          <div className="d mute">本周已完成 {weekDone.length} 件</div>
          <div className="track"><i style={{ width: `${Math.min(100, (focusMin / 600) * 100)}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: "#FDF4DC", color: "#A97C1B" }}><Star size={15} /></span>
            成长积分
          </div>
          <b>{points}<small>分</small></b>
          <div className="d mute">完成 +10 · 记录 +2</div>
          <div className="track"><i style={{ width: `${Math.min(100, (points / 600) * 100)}%` }} /></div>
        </div>
        <Link href="/habits" className="kpi kpi-link">
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: "#FDEEE6", color: "#A44F26" }}><Flame size={15} /></span>
            习惯打卡
          </div>
          <b>{habitStreak}<small>天</small></b>
          <div className="d mute">
            {habits.length === 0
              ? "还没有习惯"
              : habitPending === 0
                ? `今天都打卡了${habitBest > 0 ? ` · 历史最长 ${habitBest} 天` : ""}`
                : `今天还差 ${habitPending} 个${habitBest > 0 ? ` · 历史最长 ${habitBest} 天` : ""}`}
          </div>
          <div className="track"><i style={{ width: `${habitPct}%` }} /></div>
        </Link>
      </section>

      <div className="home-grid">
        <section className="card span2">
          <div className="c-head">
            <h2>本周成长趋势</h2>
            <span className="sub">每天专注时长</span>
            <div className="right">
              <Select
                size="sm"
                ariaLabel="时间范围"
                value={trendRange}
                onChange={(v) => setTrendRange(v as "this" | "last")}
                options={[
                  { value: "this", label: "本周" },
                  { value: "last", label: "上周" },
                ]}
              />
            </div>
          </div>
          <div className="c-body">
            <div className="trend-tip">
              <b>
                {trend.reduce((n, t) => n + t.v, 0).toFixed(1)}h
              </b>
              <span>{trendRange === "last" ? "上周" : "本周"}累计专注</span>
            </div>
            <div className="trend">
              <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="本周每日专注时长">
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3AC8C2" stopOpacity="0.26" />
                    <stop offset="100%" stopColor="#3AC8C2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[TOP, (TOP + BASE) / 2, BASE].map((y) => (
                  <line key={y} className="grid-line" x1={PADX} x2={CW - PADX} y1={y} y2={y} />
                ))}
                {trend.map((t, i) => (
                  <text key={i} className="axis" x={pts[i].x} y={CH - 8} textAnchor="middle" fontSize="15">
                    {format(t.d, "M/d")}
                  </text>
                ))}
                {[1].map((r) => (
                  <text key={r} className="axis" x={PADX - 14} y={BASE - r * (BASE - TOP) + 5} textAnchor="end" fontSize="14">
                    {(trendTop * r).toFixed(1)}h
                  </text>
                ))}
                <path d={areaPath} fill="url(#trendFill)" />
                <path d={linePath} fill="none" stroke="#3AC8C2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <circle key={i} className="dot" cx={p.x} cy={p.y} r={i === 6 ? 7 : 5.5} strokeWidth="3" />
                ))}
                {pts.length > 0 && (
                  <g>
                    <rect className="bubble" x={pts[6].x - 30} y={Math.max(2, pts[6].y - 38)} width="60" height="26" rx="13" />
                    <text x={pts[6].x} y={Math.max(2, pts[6].y - 38) + 18} textAnchor="middle" fill="#fff" fontSize="16" fontFamily="ui-monospace, monospace">
                      {trend[6].v}h
                    </text>
                  </g>
                )}
              </svg>
            </div>
            <div className="trend-legend"><span><i style={{ background: "#3AC8C2" }} />专注时长（小时）</span><span>按任务完成日统计</span></div>
          </div>
        </section>

        <section className="card">
          <div className="c-head">
            <h2>模块投入占比</h2>
            <div className="right">
              <Select
                size="sm"
                ariaLabel="时间范围"
                value={investRange}
                onChange={(v) => setInvestRange(v as "week" | "month")}
                options={[
                  { value: "week", label: "本周" },
                  { value: "month", label: "本月" },
                ]}
              />
            </div>
          </div>
          <div className="c-body">
            <div className="donut-box">
              <div className="donut" style={{ background: donutBg }}>
                <div className="mid">
                  <b>{investTotal.toFixed(1)}</b>
                  <span>{investRange === "month" ? "本月总投入" : "本周总投入"}</span>
                </div>
              </div>
              <div className="legend">
                {invest.map((i) => (
                  <div key={i.area}>
                    <i style={{ background: i.hex }} />
                    {i.label}
                    <span>{i.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="donut-foot">
              <div className="df-bar">
                {invest.map((i) => (
                  <i key={i.area} style={{ background: i.hex, flex: Math.max(i.pct, 2) }} />
                ))}
              </div>
              <p>
                {invest[0]?.pct ? (
                  <>这周你在 <b>{invest[0].label}</b> 上花的时间最多，占 {invest[0].pct}%。</>
                ) : (
                  <>本周还没有排期，先给一件事留个时间块。</>
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="card span2">
          <div className="c-head">
            <h2>最近任务</h2>
            <div className="right"><Link href="/tasks" className="ghost" style={{ padding: "3px 9px", fontSize: 10 }}>查看全部</Link></div>
          </div>
          <div className="c-body">
            <div className="task-list">
              {recent.map((t) => {
                const cs = catStyle[t.area];
                return (
                  <div key={t.id} className={`task-row ${t.status === "done" ? "done" : ""}`} onClick={() => setModal({ open: true, task: t })}>
                    <button className="check" aria-label="完成" onClick={(e) => { e.stopPropagation(); cycle(t); }}>✓</button>
                    <span className="cat" style={{ background: cs.bg, color: cs.color }}>{areaMeta[t.area].label}</span>
                    <span className="tt">{t.title}</span>
                    <span className="meta">
                      {t.due_date ? format(parseISO(t.due_date), "M月d日") : "随时"}
                      {t.scheduled_start && ` · ${format(parseISO(t.scheduled_start), "HH:mm")}`}
                      {t.priority === "high" && <span style={{ color: "#D2795C" }}>要紧</span>}
                    </span>
                    <ChevronRight size={12} color="#C2D0DB" />
                  </div>
                );
              })}
              {!recent.length && <div className="center-empty"><b>还没有任务</b><p>先加一件今天想做的事。</p></div>}
            </div>
            <div className="card-foot">
              <span>还有 <b>{openTasks.length}</b> 件待处理</span>
              <Link href="/tasks" className="ghost" style={{ padding: "3px 9px", fontSize: 10 }}>去任务面板 →</Link>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="c-head">
            <h2>本月成长日历</h2>
            <div className="right">
              <button className="ghost" style={{ padding: "2px 6px" }} aria-label="上个月" onClick={() => setCalMonth(addDays(startOfMonth(calMonth), -1))}>
                <ChevronLeft size={11} />
              </button>
              <button className="ghost" style={{ padding: "2px 6px" }} aria-label="下个月" onClick={() => setCalMonth(addDays(endOfMonth(calMonth), 2))}>
                <ChevronRight size={11} />
              </button>
            </div>
          </div>
          <div className="c-body">
            <div className="mini-cal">
              <div className="mc-head"><b>{format(calMonth, "yyyy 年 M 月", { locale: zhCN })}</b><span>{monthDoneCount} 完成</span></div>
              <div className="mc-grid">
                {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
                  <div key={w} className="wd">{w}</div>
                ))}
                {calDays.map(({ d, out }, i) => {
                  const isToday = isSameDay(d, now);
                  const has = isSameMonth(d, calMonth) && tasksOn(d);
                  const doneN = isSameMonth(d, calMonth) ? doneCountByDay.get(dayKeyOf(d)) ?? 0 : 0;
                  return (
                    <div key={i} className={`mc-day ${out ? "out" : ""} ${isToday ? "today" : has ? "has" : ""}`}>
                      <span>{format(d, "d")}</span>
                      {/* 每天完成了几件，直接写数字；没完成但有安排的点一个小点 */}
                      {doneN > 0 && <em className="mc-n">{doneN}</em>}
                      {doneN === 0 && has && !isToday && <i />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="card span2">
          <div className="c-head">
            <h2>核心模块</h2>
            <div className="right"><Link href="/tasks" className="ghost" style={{ padding: "3px 9px", fontSize: 10 }}>进入任务面板</Link></div>
          </div>
          <div className="c-body">
            <div className="mods">
              {modules.map((m) => {
                const Icon = m.icon;
                return (
                  <Link key={m.href} href={m.href} className="mod">
                    <span className="mi" style={{ background: m.bg, color: m.fg }}><Icon size={14} /></span>
                    <span style={{ minWidth: 0 }}>
                      <b>{m.label}</b>
                      <span>{m.sub}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="c-head"><h2>本周小结</h2></div>
          <div className="c-body">
            <div className="summary">
              <p>{summaryText}</p>
              <div className="mini-bars">
                {trend.map((t, i) => (
                  <i key={i} style={{ height: `${Math.max(8, (t.v / trendTop) * 100)}%` }} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card span2">
          <div className="c-head"><h2>灵感派</h2><span className="sub">从记录里挑</span>
            <div className="right"><button className="ghost" style={{ padding: "3px 9px", fontSize: 10 }} onClick={() => setSpin((v) => v + 1)}><Sparkles size={10} style={{ verticalAlign: -1 }} /> 换一批</button></div>
          </div>
          <div className="c-body">
            {candidates.length === 0 ? (
              <div className="center-empty" style={{ padding: "18px 6px" }}>
                <b>还没有可翻的记录</b>
                <p>去「记录灵感」随手写一条，这里会把它们翻出来。</p>
              </div>
            ) : (
              <div className="inspire-wide">
                <div className="donut" style={{ background: nudgeDonut, width: 132, height: 132 }}>
                  <button onClick={() => setSpin((v) => v + 1)} style={{ position: "relative", zIndex: 1 }}><Sparkles size={10} /> 转一下</button>
                </div>
                <div className="inspire-rank">
                  <div className="rank">
                    {candidates.slice(0, 3).map((c, i) => (
                      <div key={c.n.id} style={{ display: "contents" }}>
                        {/* 点一条记录 → 直接跳到那条记录，不用先回列表再找 */}
                        <Link href={`/notes?id=${c.n.id}`} className="rrow" style={{ textDecoration: "none", color: "inherit" }}>
                          <span className="no">{i + 1}</span>
                          <div className="rt">{c.n.title || (c.n.content || "").slice(0, 24) || "（空记录）"}</div>
                          <span className="pc">{c.pct}%</span>
                        </Link>
                        <div className="rbar"><i style={{ width: `${c.pct}%`, background: c.color }} /></div>
                      </div>
                    ))}
                  </div>
                  <p className="nudge-foot">这些是你写过的东西，翻出来看看能不能接着往下做。</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="c-head">
            <h2>今日一句</h2>
            <div className="right"><Link href="/notes" className="ghost" style={{ padding: "3px 9px", fontSize: 10 }}>全部</Link></div>
          </div>
          <div className="c-body">
            <div className="quote">
              <Quote size={16} />
              <div>
                每一个微小的坚持，都在让你靠近更喜欢的自己。
                {quoteNote && <em>最近记下：{quoteNote.content.slice(0, 40)}…</em>}
              </div>
            </div>
            {notes.length > 0 && (
              <div className="idea-list">
                {notes.slice(0, 3).map((n) => (
                  <Link key={n.id} href="/notes" className="idea-row">
                    <span className="ic-dot" />
                    <span className="ic-t">{n.title || n.content.slice(0, 16)}</span>
                    <span className="ic-m">{format(parseISO(n.updated_at), "M/d")}</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="card-foot"><span>共 <b>{notes.length}</b> 条记录</span></div>
          </div>
        </section>
      </div>

      <div className="sec-head">
        <h2>本周安排</h2>
        <span className="count">{weekTasks.length + weekEvents.length} 件已排期</span>
        <div className="right">
          <div className="arrows">
            <button onClick={() => setWeekOffset((v) => v - 1)} aria-label="上一周"><ChevronLeft size={11} /></button>
            <button onClick={() => setWeekOffset((v) => v + 1)} aria-label="下一周"><ChevronRight size={11} /></button>
          </div>
          <Select
            size="sm"
            ariaLabel="视图"
            value={mode}
            onChange={(v) => setMode(v as "plan" | "inspire")}
            options={[
              { value: "plan", label: "计划派" },
              { value: "inspire", label: "灵感派" },
            ]}
          />
        </div>
      </div>

      <section className="card week">
        <div className="w-head">
          <h2>给灵感留一点时间</h2>
          <span className="sub">时间块安排</span>
          <span className="range">{format(ws, "MM.dd")} – {format(addDays(ws, 6), "MM.dd")}</span>
        </div>
        <div className="w-days">
          {days.map((d, i) => (
            <button
              key={d.toISOString()}
              className={`w-day ${isSameDay(d, now) ? "today" : ""} ${dayPick === i ? "picked" : ""}`}
              onClick={() => setDayPick(dayPick === i ? -1 : i)}
              title={dayPick === i ? "再看整周" : `只看${format(d, "M月d日")}`}
            >
              {format(d, "EEEEE", { locale: zhCN })}
              <b>{format(d, "dd")}</b>
            </button>
          ))}
        </div>
        {lanes.map((lane, i) => (
          <div className="w-row" key={i}>
            {lane.map((it) => {
              if (dayPick >= 0 && it.startIdx !== dayPick) return null;
              const left = (it.startIdx / 7) * 100;
              const width = ((it.endIdx - it.startIdx + 1) / 7) * 100;
              const meta = it.task ? areaMeta[it.task.area] : null;
              return (
                <div
                  key={it.key}
                  className={`bar ${meta ? meta.cls : "lav"}`}
                  style={{ left: `${left}%`, width: `calc(${width}% - 4px)` }}
                  title={it.title}
                  onClick={() => {
                    if (it.task) setModal({ open: true, task: it.task });
                    else if (it.event) router.push("/calendar");
                  }}
                >
                  {it.kind === "event" && <CalendarDays size={9} style={{ verticalAlign: -1, marginRight: 3 }} />}
                  {it.title}
                </div>
              );
            })}
          </div>
        ))}
        {lanes.length === 0 && <div className="w-row" style={{ display: "flex", alignItems: "center", color: "#B9CAD8", fontSize: 9 }}>本周还没有安排到具体时间的事。</div>}
        <div className="w-foot">
          {(Object.keys(areaMeta) as Area[]).map((a) => (
            <span key={a}><i style={{ background: areaMeta[a].hex }} />{areaMeta[a].label}</span>
          ))}
          <span><i style={{ background: "#A78BFA" }} />日程</span>
          <span style={{ marginLeft: "auto" }}>点时间块可编辑 · 点日期只看那天</span>
        </div>
      </section>

      <TaskModal open={modal.open} task={modal.task} onClose={() => setModal({ open: false, task: null })} />
    </>
  );
}

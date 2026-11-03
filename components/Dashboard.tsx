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
  Wand2,
  ChartNoAxesColumn,
} from "lucide-react";
import type { Task, EventRow, Note, Area } from "@/lib/db";
import { useTasks } from "@/lib/use-tasks";
import { usePointerDrag } from "@/lib/use-pointer-drag";
import { DragGhostLayer } from "./DragGhost";
import TaskModal from "./TaskModal";
import TopBar from "./TopBar";

const areaMeta: Record<Area, { label: string; cls: string; hex: string }> = {
  work: { label: "工作", cls: "sky", hex: "#5AA7E8" },
  side: { label: "副业", cls: "lav", hex: "#A78BFA" },
  media: { label: "自媒体", cls: "peach", hex: "#F5AE8E" },
  study: { label: "学习", cls: "mint", hex: "#6FD6BE" },
  life: { label: "生活", cls: "amber", hex: "#F6C453" },
};

const cols: { key: "todo" | "doing" | "done"; label: string; dot: string }[] = [
  { key: "todo", label: "待办", dot: "#5AA7E8" },
  { key: "doing", label: "进行中", dot: "#F6C453" },
  { key: "done", label: "完成", dot: "#3AC8C2" },
];

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
  weekStart,
}: {
  tasks: Task[];
  events: EventRow[];
  notes: Note[];
  weekStart: string;
}) {
  const router = useRouter();
  const { tasks, cycle, setStatus } = useTasks(tasksProp);
  const { begin, ghost, didDrag } = usePointerDrag<{ id: number; from: Task["status"] }>(({ payload, x, y }) => {
    const el = document.elementFromPoint(x, y);
    const col = el?.closest("[data-status]") as HTMLElement | null;
    setHover(null);
    const next = col?.dataset.status as Task["status"] | undefined;
    const t = tasks.find((x2) => x2.id === payload.id);
    if (t && next && next !== payload.from) setStatus(t, next);
  });
  const [hover, setHover] = useState<string | null>(null);
  const [mode, setMode] = useState<"plan" | "inspire">("plan");
  const [modal, setModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [weekOffset, setWeekOffset] = useState(0);
  const [spin, setSpin] = useState(0);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [ghostId, setGhostId] = useState<number | null>(null);

  const now = new Date();
  const ws = addDays(parseISO(weekStart), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const todayAll = tasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), now));
  const todayOpen = todayAll.filter((t) => t.status !== "done");
  const todayDone = todayAll.filter((t) => t.status === "done");
  const todayPct = todayAll.length ? Math.round((todayDone.length / todayAll.length) * 100) : 0;

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

  const weekDone = doneTasks.filter((t) => t.done_at && parseISO(t.done_at) >= startOfWeek(now, { weekStartsOn: 1 }));
  const focusMin = weekDone.reduce((n, t) => n + (t.estimate_min ?? 20), 0);
  const focusH = (focusMin / 60).toFixed(1);
  const points = doneTasks.length * 10 + notes.length * 2;

  const trend = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, 6 - i);
      const mins = doneTasks
        .filter((t) => t.done_at && isSameDay(parseISO(t.done_at), d))
        .reduce((n, t) => n + (t.estimate_min ?? 20), 0);
      return { d, v: Math.round((mins / 60) * 10) / 10 };
    });
  }, [doneTasks, now]);

  const weekTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.scheduled_start) return false;
        const s = parseISO(t.scheduled_start);
        return s >= ws && s < addDays(ws, 7);
      }),
    [tasks, ws]
  );

  const lanes = useMemo(() => {
    const items = weekTasks
      .map((t) => {
        const s = parseISO(t.scheduled_start as string);
        const e = t.scheduled_end ? parseISO(t.scheduled_end) : s;
        const startIdx = Math.max(0, Math.min(6, differenceInCalendarDays(s, ws)));
        const endIdx = Math.max(startIdx, Math.min(6, differenceInCalendarDays(e, ws)));
        return { task: t, startIdx, endIdx };
      })
      .sort((a, b) => a.startIdx - b.startIdx);
    const rows: { task: Task; startIdx: number; endIdx: number }[][] = [];
    for (const it of items) {
      const lane = rows.find((r) => r[r.length - 1].endIdx < it.startIdx);
      if (lane) lane.push(it);
      else rows.push([it]);
    }
    return rows;
  }, [weekTasks, ws]);

  const invest = useMemo(() => {
    const map = new Map<Area, number>();
    for (const t of weekTasks) {
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
  }, [weekTasks, openTasks]);

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

  const candidates = useMemo(() => {
    const score = (t: Task) =>
      (t.priority === "high" ? 3 : t.priority === "med" ? 2 : 1) +
      (t.status === "doing" ? 2 : 0) +
      (t.due_date && isSameDay(parseISO(t.due_date), now) ? 2 : 0);
    const list = openTasks.map((t) => ({ t, s: score(t) })).sort((a, b) => b.s - a.s).slice(0, 5);
    const sum = list.reduce((n, x) => n + x.s, 0) || 1;
    return list.map((x, i) => ({
      ...x,
      pct: Math.round((x.s / sum) * 100),
      color: ["#3AC8C2", "#5AA7E8", "#A78BFA", "#F5AE8E", "#F6C453"][i % 5],
    }));
  }, [openTasks, now]);

  const nudgeDonut = useMemo(() => {
    let acc = 0;
    const stops = candidates.map((c) => {
      const from = acc;
      acc += c.pct;
      return `${c.color} ${from}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(",") || "#E8F2FC 0 100%"})`;
  }, [candidates]);

  const recent = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const rank = (t: Task) => (t.status === "done" ? 2 : t.status === "doing" ? 0 : 1);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
      })
      .slice(0, 8);
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

  const quoteNote = notes.find((n) => n.content && n.content.trim().length > 8);

  return (
    <>
      <TopBar crumb="成长总览">
        <button className="primary" onClick={() => setModal({ open: true, task: null })}>
          <Plus size={12} /> 添加任务
        </button>
      </TopBar>

      <div className="hello">
        <div>
          <div className="eyebrow">{format(now, "yyyy.MM.dd")} · {format(now, "EEEE", { locale: zhCN })}</div>
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
          <div className="d mute">已完成 {todayDone.length} 项</div>
          <div className="track"><i style={{ width: `${todayPct}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: "#E3F8F2", color: "#2E8C77" }}><CheckCircle2 size={15} /></span>
            完成率
          </div>
          <b>{todayPct}%</b>
          <div className="d"><TrendingUp size={10} /> {todayPct >= yPct ? "较昨日 +" : "较昨日 "}{Math.abs(todayPct - yPct)}%</div>
          <div className="track"><i style={{ width: `${todayPct}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: "#FDEEE6", color: "#C2622F" }}><Flame size={15} /></span>
            连续天数
          </div>
          <b>{streak}<small>天</small></b>
          <div className="d mute">累计完成 {doneTasks.length} 件</div>
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
      </section>

      <div className="home-grid">
        <section className="card span2">
          <div className="c-head">
            <h2>本周成长趋势</h2>
            <span className="sub">每天专注时长</span>
            <div className="right">
              <select aria-label="时间范围"><option>本周</option><option>上周</option></select>
            </div>
          </div>
          <div className="c-body">
            <div className="trend-tip"><b>{focusH}h</b><span>本周累计专注</span></div>
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
            <div className="right"><select aria-label="范围"><option>本周</option><option>本月</option></select></div>
          </div>
          <div className="c-body">
            <div className="donut-box">
              <div className="donut" style={{ background: donutBg }}>
                <div className="mid"><b>{investTotal.toFixed(1)}</b><span>本周总投入</span></div>
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
              <div className="mc-head"><b>{format(calMonth, "yyyy 年 M 月", { locale: zhCN })}</b><span>{doneTasks.length} 完成</span></div>
              <div className="mc-grid">
                {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
                  <div key={w} className="wd">{w}</div>
                ))}
                {calDays.map(({ d, out }, i) => {
                  const isToday = isSameDay(d, now);
                  const has = isSameMonth(d, calMonth) && tasksOn(d);
                  return (
                    <div key={i} className={`mc-day ${out ? "out" : ""} ${isToday ? "today" : has ? "has" : ""}`}>
                      {format(d, "d")}
                      {has && !isToday && <i />}
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
          <div className="c-head"><h2>灵感派</h2><span className="sub">随心开始</span>
            <div className="right"><button className="ghost" style={{ padding: "3px 9px", fontSize: 10 }} onClick={() => setSpin((v) => v + 1)}><Sparkles size={10} style={{ verticalAlign: -1 }} /> 换一批</button></div>
          </div>
          <div className="c-body">
            {candidates.length === 0 ? (
              <div className="center-empty" style={{ padding: "18px 6px" }}><b>现在没有待办</b><p>加一件想做的事。</p></div>
            ) : (
              <div className="inspire-wide">
                <div className="donut" style={{ background: nudgeDonut, width: 132, height: 132 }}>
                  <button onClick={() => setSpin((v) => v + 1)} style={{ position: "relative", zIndex: 1 }}><Sparkles size={10} /> 转一下</button>
                </div>
                <div className="inspire-rank">
                  <div className="rank">
                    {candidates.slice(0, 3).map((c, i) => (
                      <div key={c.t.id} style={{ display: "contents" }}>
                        <div className="rrow" onClick={() => setModal({ open: true, task: c.t })}>
                          <span className="no">{i + 1}</span>
                          <div className="rt">{c.t.title}</div>
                          <span className="pc">{c.pct}%</span>
                        </div>
                        <div className="rbar"><i style={{ width: `${c.pct}%`, background: c.color }} /></div>
                      </div>
                    ))}
                  </div>
                  <p className="nudge-foot">不必计划好全部，先迈出一步。</p>
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
        <span className="count">{weekTasks.length} 件已排期</span>
        <div className="right">
          <div className="arrows">
            <button onClick={() => setWeekOffset((v) => v - 1)} aria-label="上一周"><ChevronLeft size={11} /></button>
            <button onClick={() => setWeekOffset((v) => v + 1)} aria-label="下一周"><ChevronRight size={11} /></button>
          </div>
          <select aria-label="视图" value={mode} onChange={(e) => setMode(e.target.value as "plan" | "inspire")}>
            <option value="plan">计划派</option>
            <option value="inspire">灵感派</option>
          </select>
        </div>
      </div>

      <section className="card week">
        <div className="w-head">
          <h2>给灵感留一点时间</h2>
          <span className="sub">时间块安排</span>
          <span className="range">{format(ws, "MM.dd")} – {format(addDays(ws, 6), "MM.dd")}</span>
        </div>
        <div className="w-days">
          {days.map((d) => (
            <div key={d.toISOString()} className={isSameDay(d, now) ? "today" : ""}>
              {format(d, "EEEEE", { locale: zhCN })}
              <b>{format(d, "dd")}</b>
            </div>
          ))}
        </div>
        {lanes.map((lane, i) => (
          <div className="w-row" key={i}>
            {lane.map((it) => {
              const meta = areaMeta[it.task.area];
              const left = (it.startIdx / 7) * 100;
              const width = ((it.endIdx - it.startIdx + 1) / 7) * 100;
              return (
                <div
                  key={it.task.id}
                  className={`bar ${meta.cls}`}
                  style={{ left: `${left}%`, width: `calc(${width}% - 4px)` }}
                  title={it.task.title}
                  onClick={() => setModal({ open: true, task: it.task })}
                >
                  {it.task.title}
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
          <span style={{ marginLeft: "auto" }}>点一下时间块可编辑</span>
        </div>
      </section>

      <div className="sec-head">
        <h2>任务看板</h2>
        <span className="count">{openTasks.length} 件待处理</span>
        <div className="right">
          <button className="ghost" style={{ padding: "4px 10px", fontSize: 10 }} onClick={() => setModal({ open: true, task: null })}>＋ 新任务</button>
        </div>
      </div>
      <div className="kanban">
        {cols.map((c) => {
          const list = tasks.filter((t) => t.status === c.key);
          return (
            <div
              className={`col ${hover === c.key && ghost ? "drop-hot" : ""}`}
              key={c.key}
              data-status={c.key}
              onPointerMove={() => { if (ghost && hover !== c.key) setHover(c.key); }}
              onPointerLeave={() => setHover((h) => (h === c.key ? null : h))}
            >
              <div className="col-head">
                <span className="dot" style={{ background: c.dot }} />
                <b>{c.label}</b>
                <span className="n">{list.length}</span>
                <button onClick={() => setModal({ open: true, task: null })} aria-label={`添加${c.label}任务`}>＋</button>
              </div>
              {list.map((t) => (
                <div
                  className={`tcard ${t.status === "done" ? "done" : ""} ${ghost && ghostId === t.id ? "lifted" : ""}`}
                  key={t.id}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    setGhostId(t.id);
                    begin(e, { id: t.id, from: t.status }, t.title, c.dot);
                  }}
                  onClick={() => {
                    if (didDrag.current) {
                      didDrag.current = false;
                      return;
                    }
                    setModal({ open: true, task: t });
                  }}
                >
                  <div className="ct">{t.title}</div>
                  <div className="cm">
                    <span>{t.due_date ? format(parseISO(t.due_date), "M/d") : "随时"}</span>
                    <span className="cat">{areaMeta[t.area].label}</span>
                    {t.priority === "high" && <span style={{ color: "#D2795C" }}>· 要紧</span>}
                  </div>
                  <button className="check" aria-label={t.status === "done" ? "标记未完成" : "标记完成"} onClick={(e) => { e.stopPropagation(); cycle(t); }}>
                    ✓
                  </button>
                </div>
              ))}
              {!list.length && <div className="empty-col">这里还是空的</div>}
              <button className="col-add" onClick={() => setModal({ open: true, task: null })}>＋ 添加{c.label}任务</button>
            </div>
          );
        })}
      </div>

      <div className="foot-hint">
        <span className="line" /> 待办与进行中，都可以成为下一步 <b>{doneTasks.length} / {tasks.length}</b> <span className="line" />
      </div>

      <DragGhostLayer ghost={ghost} />
      <TaskModal open={modal.open} task={modal.task} onClose={() => setModal({ open: false, task: null })} />
    </>
  );
}

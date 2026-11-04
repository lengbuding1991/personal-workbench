"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from "lucide-react";
import type { EventRow, Task } from "@/lib/db";
import TopBar from "./TopBar";
import { useConfirm } from "./Confirm";
import { useToast } from "./Toast";

type Draft = {
  mode: "new" | "edit";
  id?: number;
  title: string;
  start: string;
  end: string;
  place: string;
  note: string;
  allDay: boolean;
};

const DAY_START = 0;
const DAY_END = 24;
const HOUR = 48;
const SNAP = 15;
/** 「空闲」块只在白天标，凌晨那种天然没人排的时段不凑热闹 */
const GAP_START = 7 * 60;
const GAP_END = 23 * 60;

const areaColor: Record<string, string> = {
  work: "#5AA7E8",
  side: "#A78BFA",
  media: "#F5AE8E",
  study: "#6FD6BE",
  life: "#F6C453",
};
const areaLabel: Record<string, string> = { work: "工作", side: "副业", media: "自媒体", study: "学习", life: "生活" };
const tones = ["sky", "mint", "lav", "peach", "amber"] as const;

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const toLocalInput = (mins: number) => `${hhmm(mins)}`;

function minutesOf(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function laneLayout(items: { id: number; start: number; end: number }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = new Map<number, { lane: number; lanes: number }>();
  let cluster: typeof sorted = [];
  let laneEnds: number[] = [];

  const flush = () => {
    const n = Math.max(1, laneEnds.length);
    for (const it of cluster) {
      const o = out.get(it.id);
      if (o) o.lanes = n;
    }
    cluster = [];
    laneEnds = [];
  };

  for (const it of sorted) {
    // 与当前簇内任何一条都不重叠 → 另起一簇
    const overlaps = cluster.some((c) => it.start < c.end);
    if (cluster.length && !overlaps) flush();
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else {
      laneEnds[lane] = it.end;
    }
    out.set(it.id, { lane, lanes: 1 });
    cluster.push(it);
  }
  flush();
  return out;
}

export default function CalendarApp({ events, tasks }: { events: EventRow[]; tasks: Task[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [list, setList] = useState<EventRow[]>(events);
  const [taskList, setTaskList] = useState<Task[]>(tasks);
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"week" | "day">("week");
  const [selected, setSelected] = useState(new Date());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragTip, setDragTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hover, setHover] = useState<{ day: string; mins: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 手机上 7 列时间轴太挤，默认给日视图
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 760) setView("day");
  }, []);

  // 打开时把当前时间放到视口上方 1/3 处，往前留一屏回顾
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nowM = new Date().getHours() * 60 + new Date().getMinutes();
    const target = Math.max(DAY_START * 60, nowM - 180);
    el.scrollTop = Math.max(0, (target - DAY_START * 60) / 60 * HOUR);
  }, [view]);

  const ws = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offset * 7);
  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(ws, i)) : [selected];

  const headTone = (id: number) => tones[id % tones.length];

  /* ---------------- 数据分组 ---------------- */
  const allDayOf = (key: string) => list.filter((e) => e.all_day && e.start_at.slice(0, 10) === key);
  const timedOf = (key: string) =>
    list
      .filter((e) => !e.all_day && e.start_at.slice(0, 10) === key)
      .map((e) => {
        const s = parseISO(e.start_at);
        const start = minutesOf(s);
        const end = e.end_at ? minutesOf(parseISO(e.end_at)) : start + 45;
        return { e, start, end: Math.max(start + SNAP, end) };
      });
  const tasksOf = (key: string) =>
    taskList.filter((t) => t.status !== "done" && t.due_date && t.due_date.slice(0, 10) === key);

  /** 某些天全空的时段，用淡淡的「空闲」块填住，避免整列发白 */
  const gapsOf = (key: string, minGap = 120) => {
    const busy = timedOf(key)
      .map((x) => [Math.max(x.start, GAP_START), Math.min(x.end, GAP_END)] as [number, number])
      .filter(([st, en]) => en > st)
      .sort((a, b) => a[0] - b[0]);
    const out: { from: number; to: number }[] = [];
    let cur = GAP_START;
    for (const [st, en] of busy) {
      if (st - cur >= minGap) out.push({ from: cur, to: Math.min(st, GAP_END) });
      cur = Math.max(cur, en);
    }
    if (GAP_END - cur >= minGap) out.push({ from: cur, to: GAP_END });
    return out;
  };

  /* ---------------- 拖动 ---------------- */
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number; colW: number } | null>(null);
  const justDragged = useRef(false);

  const startEventDrag = (e: React.PointerEvent, ev: EventRow, startMin: number, dur: number, dayIdx: number, resizing: boolean) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const colEl = el.closest("[data-col]") as HTMLElement | null;
    const colW = colEl?.getBoundingClientRect().width ?? 160;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;

    const move = (pe: PointerEvent) => {
      const dx = pe.clientX - sx;
      const dy = pe.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      document.body.classList.add("dragging");
      setDrag({ id: ev.id, dx, dy, colW });
      const dMin = Math.round(dy / HOUR * 60 / SNAP) * SNAP;
      const dDay = Math.round(dx / colW);
      const idx = Math.max(0, Math.min(days.length - 1, dayIdx + dDay));
      const st = resizing
        ? startMin
        : Math.max(DAY_START * 60, Math.min(DAY_END * 60 - dur, startMin + dMin));
      const dur2 = resizing ? Math.max(SNAP, dur + dMin) : dur;
      setDragTip({
        x: pe.clientX,
        y: pe.clientY,
        text: resizing
          ? `${format(days[idx], "M月d日")} ${hhmm(st)}–${hhmm(Math.min(DAY_END * 60, st + dur2))}`
          : `${format(days[idx], "M月d日")} ${hhmm(st)}`,
      });
    };

    const up = async (pe: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("dragging");
      setDrag(null);
      setDragTip(null);
      if (!moved) return;
      justDragged.current = true;
      window.setTimeout(() => { justDragged.current = false; }, 120);

      const dx = pe.clientX - sx;
      const dy = pe.clientY - sy;
      const dMin = Math.round(dy / HOUR * 60 / SNAP) * SNAP;
      const dDay = Math.round(dx / colW);

      let nextStart = Math.max(DAY_START * 60, Math.min(DAY_END * 60 - dur, startMin + dMin));
      let nextDur = dur;
      if (resizing) {
        nextStart = startMin;
        nextDur = Math.max(SNAP, dur + dMin);
      }
      const idx = Math.max(0, Math.min(days.length - 1, dayIdx + dDay));
      const base = format(days[idx], "yyyy-MM-dd");
      const start_at = `${base}T${toLocalInput(nextStart)}`;
      const end_at = `${base}T${toLocalInput(Math.min(DAY_END * 60, nextStart + nextDur))}`;

      const prev = { start_at: ev.start_at, end_at: ev.end_at };
      setList((l) => l.map((x) => (x.id === ev.id ? { ...x, start_at, end_at } : x)));
      const res = await fetch(`/api/events/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_at, end_at }),
      });
      if (!res.ok) {
        setList((l) => l.map((x) => (x.id === ev.id ? { ...x, ...prev } : x)));
        toast("没拖动成功，再试一次");
        return;
      }
      toast(`「${ev.title}」移到 ${format(parseISO(start_at), "M月d日 HH:mm")}`);
      router.refresh();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const startTaskDrag = (e: React.PointerEvent, t: Task) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    let ghostEl: HTMLElement | null = null;

    const move = (pe: PointerEvent) => {
      if (!moved && Math.hypot(pe.clientX - sx, pe.clientY - sy) < 4) return;
      moved = true;
      document.body.classList.add("dragging");
      if (!ghostEl) {
        ghostEl = document.createElement("div");
        ghostEl.className = "drag-ghost";
        ghostEl.innerHTML = `<span class="dg-dot" style="background:${areaColor[t.area]}"></span>${t.title}`;
        document.body.appendChild(ghostEl);
      }
      ghostEl.style.left = `${pe.clientX + 14}px`;
      ghostEl.style.top = `${pe.clientY + 10}px`;
      document.querySelectorAll(".cal2-col.hot").forEach((n) => n.classList.remove("hot"));
      const hit = (document.elementFromPoint(pe.clientX, pe.clientY) as HTMLElement | null)?.closest("[data-col]") as HTMLElement | null;
      hit?.classList.add("hot");
      void el;
    };

    const up = async (pe: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("dragging");
      ghostEl?.remove();
      document.querySelectorAll(".cal2-col.hot").forEach((n) => n.classList.remove("hot"));
      if (!moved) return;
      justDragged.current = true;
      window.setTimeout(() => { justDragged.current = false; }, 120);

      const hit = (document.elementFromPoint(pe.clientX, pe.clientY) as HTMLElement | null)?.closest("[data-col]") as HTMLElement | null;
      const key = hit?.dataset.day;
      if (!key || key === (t.due_date || "").slice(0, 10)) return;

      const prev = t.due_date;
      setTaskList((l) => l.map((x) => (x.id === t.id ? { ...x, due_date: key } : x)));
      const res = await fetch(`/api/tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: key }),
      });
      if (!res.ok) {
        setTaskList((l) => l.map((x) => (x.id === t.id ? { ...x, due_date: prev } : x)));
        toast("没拖动成功，再试一次");
        return;
      }
      toast(`「${t.title}」改到 ${format(parseISO(key), "M月d日")}`);
      router.refresh();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /* ---------------- 新建 / 编辑 ---------------- */
  const openNew = (d: Date, minutes?: number) => {
    const startMin = minutes ?? 9 * 60;
    const base = format(d, "yyyy-MM-dd");
    setDraft({
      mode: "new",
      title: "",
      start: `${base}T${hhmm(startMin)}`,
      end: `${base}T${hhmm(startMin + 60)}`,
      place: "",
      note: "",
      allDay: false,
    });
  };

  const openEdit = (e: EventRow) =>
    setDraft({
      mode: "edit",
      id: e.id,
      title: e.title,
      start: e.all_day ? `${e.start_at.slice(0, 10)}T00:00` : e.start_at.slice(0, 16),
      end: e.end_at ? (e.all_day ? `${e.end_at.slice(0, 10)}T00:00` : e.end_at.slice(0, 16)) : "",
      place: e.location || "",
      note: e.note || "",
      allDay: !!e.all_day,
    });

  const save = async () => {
    if (!draft || !draft.title.trim() || !draft.start) return;
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      start_at: draft.start,
      end_at: draft.end || null,
      location: draft.place,
      note: draft.note,
      all_day: draft.allDay ? 1 : 0,
    };
    try {
      if (draft.mode === "edit" && draft.id) {
        const res = await fetch(`/api/events/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.event) setList((l) => l.map((x) => (x.id === draft.id ? { ...x, ...data.event } : x)));
        toast("日程已更新");
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.event) setList((l) => [...l, { ...data.event }]);
        toast(`「${payload.title}」已加到日历`);
      }
      setDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const del = async (e: EventRow) => {
    const ok = await confirm({
      title: "删除这个日程？",
      desc: `「${e.title}」会从日历上移除。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    setList((l) => l.filter((x) => x.id !== e.id));
    setDraft(null);
    await fetch(`/api/events/${e.id}`, { method: "DELETE" });
    router.refresh();
    toast(`已删除「${e.title}」`, {
      label: "撤销",
      onClick: async () => {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: e.title, start_at: e.start_at, end_at: e.end_at, location: e.location, all_day: e.all_day }),
        });
        const data = await res.json();
        if (data.event) setList((l) => [...l, { ...data.event }]);
        router.refresh();
      },
    });
  };

  const weekCount = useMemo(
    () => list.filter((e) => days.some((d) => e.start_at.slice(0, 10) === format(d, "yyyy-MM-dd"))).length,
    [list, days]
  );

  /* 这天的空档：起床到 21 点之间，没被日程占住、≥60 分钟的连续区间 */
  const dayKey = format(selected, "yyyy-MM-dd");
  const dayEvents = list.filter((e) => e.start_at.slice(0, 10) === dayKey);
  const busy = dayEvents
    .filter((e) => !e.all_day)
    .map((e) => [
      minutesOf(parseISO(e.start_at)),
      e.end_at ? minutesOf(parseISO(e.end_at)) : minutesOf(parseISO(e.start_at)) + 45,
    ] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const gaps: { from: number; to: number }[] = [];
  {
    let cursor = 9 * 60;
    for (const [st, en] of busy) {
      if (st - cursor >= 60) gaps.push({ from: cursor, to: st });
      cursor = Math.max(cursor, en);
    }
    if (21 * 60 - cursor >= 60) gaps.push({ from: cursor, to: 21 * 60 });
  }
  const dayTasks = tasksOf(dayKey);

  const header = (
    <div className="page-head">
      <div>
        <div className="eyebrow">CALENDAR · 日历安排</div>
        <h1>{view === "week" ? "这一周，先占住时间。" : "这一天，先占住时间。"}</h1>
        <p>
          {view === "week"
            ? `${format(ws, "M月d日")} – ${format(addDays(ws, 6), "M月d日")} · ${weekCount} 个日程`
            : format(selected, "yyyy年M月d日 EEEE", { locale: zhCN })}
          {" · "}拖动日程可改时间，点空白处新建
        </p>
      </div>
      <div className="right">
        <button className={`chip ${view === "week" ? "on" : ""}`} onClick={() => setView("week")}>周</button>
        <button className={`chip ${view === "day" ? "on" : ""}`} onClick={() => setView("day")}>日</button>
        <button
          className="ghost"
          onClick={() => {
            if (view === "week") setOffset((v) => v - 1);
            else setSelected((d) => addDays(d, -1));
          }}
        >
          <ChevronLeft size={12} />
        </button>
        <button className="ghost" onClick={() => { setOffset(0); setSelected(new Date()); }}>今天</button>
        <button
          className="ghost"
          onClick={() => {
            if (view === "week") setOffset((v) => v + 1);
            else setSelected((d) => addDays(d, 1));
          }}
        >
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );

  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const hasAllDay = days.some((d) => {
    const k = format(d, "yyyy-MM-dd");
    return allDayOf(k).length > 0 || tasksOf(k).length > 0;
  });
  const now = new Date();
  const nowTop = (minutesOf(now) - DAY_START * 60) / 60 * HOUR;

  return (
    <>
      <TopBar crumb="日历">
        <button className="primary" onClick={() => openNew(view === "week" ? new Date() : selected)}>
          <Plus size={12} style={{ verticalAlign: -2, marginRight: 3 }} />新日程
        </button>
      </TopBar>
      {header}

      <div className={view === "day" ? "cal2-daywrap" : ""}>
      <section className="card cal2-card">
        {/* 移动端周视图：每天一卡的日程列表（桌面端隐藏） */}
        <div className="cal2-mweek">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const evs = timedOf(key);
            const allday = allDayOf(key);
            const tks = tasksOf(key);
            const isToday = isSameDay(d, now);
            return (
              <div className="mw-day" key={`mw-${key}`}>
                <div className="mw-head">
                  <span>{format(d, "EEE", { locale: zhCN })}</span>
                  <b>{format(d, "M月d日")}</b>
                  {isToday && <i>今天</i>}
                  {evs.length + allday.length + tks.length > 0 && <i>{evs.length + allday.length + tks.length}</i>}
                  <button aria-label="新建" onClick={() => openNew(d)}><Plus size={13} /></button>
                </div>
                {allday.map((e) => (
                  <div key={`a-${e.id}`} className="mw-ev" onClick={() => openEdit(e)}>
                    <span>全天</span><b>{e.title}</b>
                  </div>
                ))}
                {evs.map(({ e, start, end }) => (
                  <div key={e.id} className="mw-ev" onClick={() => openEdit(e)}>
                    <span>{hhmm(start)}–{hhmm(end)}</span><b>{e.title}</b>
                    {e.location ? <em>{e.location}</em> : null}
                  </div>
                ))}
                {tks.map((t) => (
                  <div key={`t-${t.id}`} className="mw-ev" onClick={() => { window.location.href = `/tasks?focus=${t.id}`; }}>
                    <span>任务</span><b>{t.title}</b>
                  </div>
                ))}
                {!evs.length && !allday.length && !tks.length && <div className="mw-empty">这天空着，点右上角 + 安排</div>}
              </div>
            );
          })}
        </div>

        <div className="cal2-scroll" ref={scrollRef}>
          <div className="cal2-grid" style={{ gridTemplateColumns: `54px repeat(${days.length}, minmax(112px, 1fr))` }}>
            <div className="cal2-corner">{view === "week" ? "周" : "日"}</div>
            {days.map((d) => {
              const isToday = isSameDay(d, now);
              return (
                <div
                  className={`cal2-chead ${isToday ? "today" : ""} ${[0, 6].includes(d.getDay()) ? "weekend" : ""}`}
                  key={`h-${format(d, "yyyy-MM-dd")}`}
                >
                  <span>{format(d, "EEE", { locale: zhCN })}</span>
                  <b>{format(d, "d")}</b>
                  {(() => {
                    const k = format(d, "yyyy-MM-dd");
                    const n = timedOf(k).length + allDayOf(k).length;
                    return n > 0 ? <i className="ch-n">{n}</i> : null;
                  })()}
                  <button aria-label="新建" onClick={() => openNew(d)}>
                    <Plus size={11} />
                  </button>
                </div>
              );
            })}

            {hasAllDay && <div className="cal2-glabel">全天</div>}
            {hasAllDay && days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              return (
                <div className={`cal2-allday ${isSameDay(d, now) ? "today" : ""}`} key={`a-${key}`} data-day={key} data-col>
                  {allDayOf(key).map((e) => (
                    <div key={e.id} className={`cal2-chip ${headTone(e.id)}`} onClick={() => openEdit(e)} title="点击编辑">
                      {e.title}
                    </div>
                  ))}
                  {tasksOf(key).map((t) => (
                    <div
                      key={`t-${t.id}`}
                      className="cal2-task"
                      style={{ borderColor: areaColor[t.area] }}
                      onPointerDown={(ev) => startTaskDrag(ev, t)}
                      onClick={() => {
                        if (justDragged.current) return;
                        window.location.href = `/tasks?focus=${t.id}`;
                      }}
                      title="拖动可改截止日"
                    >
                      <span className="ct-dot" style={{ background: areaColor[t.area] }} />
                      {t.title}
                    </div>
                  ))}
                  {!allDayOf(key).length && !tasksOf(key).length && <span className="cal2-plus">＋</span>}
                </div>
              );
            })}

            <div className="cal2-gutter">
              {hours.map((h) => (
                <div className={`cal2-hr ${h < 6 ? "night" : ""}`} key={h}>{String(h).padStart(2, "0")}:00</div>
              ))}
            </div>

            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const items = timedOf(key);
              const layout = laneLayout(items.map((x) => ({ id: x.e.id, start: x.start, end: x.end })));
              const isToday = isSameDay(d, now);
              return (
                <div
                  className={`cal2-col ${isToday ? "today" : ""} ${[0, 6].includes(d.getDay()) ? "weekend" : ""}`}
                  key={`c-${key}`}
                  data-day={key}
                  data-col
                  style={{ height: (DAY_END - DAY_START) * HOUR }}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest(".cal2-ev")) return;
                    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const mins = DAY_START * 60 + ((e.clientY - box.top) / HOUR) * 60;
                    openNew(d, Math.max(DAY_START * 60, Math.round(mins / 30) * 30));
                  }}
                  onPointerMove={(e) => {
                    if (drag) return;
                    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const raw = DAY_START * 60 + ((e.clientY - box.top) / HOUR) * 60;
                    const snap = Math.max(DAY_START * 60, Math.min(DAY_END * 60, Math.round(raw / SNAP) * SNAP));
                    setHover((h) => (h && h.day === key && h.mins === snap ? h : { day: key, mins: snap }));
                  }}
                  onPointerLeave={() => setHover((h) => (h && h.day === key ? null : h))}
                >
                  {hours.map((h) => (
                    <div className="cal2-line" key={h} style={{ top: (h - DAY_START) * HOUR }} />
                  ))}
                  {DAY_START < 6 && <div className="cal2-night" style={{ height: (6 - DAY_START) * HOUR }} />}
                  {items.length === 0 && view === "week" && (
                    <div className="cal2-empty">
                      <span>这天空着</span>
                      <em>点一下就能排</em>
                    </div>
                  )}
                  {view === "week" && items.length > 0 && gapsOf(key, 150).map((g) => (
                    <div
                      key={`g-${g.from}`}
                      className="cal2-free"
                      style={{ top: (g.from - DAY_START * 60) / 60 * HOUR + 2, height: (g.to - g.from) / 60 * HOUR - 4 }}
                    >
                      <span>空闲 {Math.round((g.to - g.from) / 60 * 10) / 10}h</span>
                    </div>
                  ))}
                  {hover?.day === key && (
                    <div className="cal2-ghostline" style={{ top: (hover.mins - DAY_START * 60) / 60 * HOUR }}>
                      <b>{hhmm(hover.mins)}</b>
                    </div>
                  )}
                  {isToday && nowTop >= 0 && nowTop <= (DAY_END - DAY_START) * HOUR && (
                    <div className="cal2-now" style={{ top: nowTop }}>
                      <span className="nub" />
                    </div>
                  )}
                  {items.map(({ e, start, end }) => {
                    const lay = layout.get(e.id) ?? { lane: 0, lanes: 1 };
                    const top = (start - DAY_START * 60) / 60 * HOUR;
                    const h = Math.max(22, (end - start) / 60 * HOUR - 3);
                    const w = 100 / lay.lanes;
                    const dragging = drag?.id === e.id;
                    const dayIdx = days.findIndex((x) => format(x, "yyyy-MM-dd") === key);
                    return (
                      <div
                        key={e.id}
                        className={`cal2-ev ${headTone(e.id)} ${dragging ? "dragging" : ""}`}
                        style={{
                          top,
                          height: h,
                          left: `calc(${w * lay.lane}% + 3px)`,
                          width: `calc(${w}% - 6px)`,
                          transform: dragging ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined,
                        }}
                        onPointerDown={(ev) => startEventDrag(ev, e, start, end - start, dayIdx, false)}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (!justDragged.current) openEdit(e);
                        }}
                      >
                        <b>{e.title}</b>
                        {h >= 34 && <span>{hhmm(start)}–{hhmm(end)}</span>}
                        {h >= 52 && e.location && <span className="ev-loc">{e.location}</span>}
                        <i
                          className="cal2-resize"
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            startEventDrag(ev, e, start, end - start, dayIdx, true);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div className="cal2-foot">
          <span className="cf-tip"><b>拖动</b> 日程方块改时间</span>
          <span className="cf-tip"><b>拖底边</b> 改时长</span>
          <span className="cf-tip"><b>拖任务卡</b> 改截止日</span>
          <span className="cf-tip"><b>点空白</b> 直接新建</span>
        </div>
      </section>

      {view === "day" && (
        <aside className="card day-side">
          <div className="c-head">
            <h2>这天要做</h2>
            <span className="sub">{dayTasks.length} 件</span>
          </div>
          <div className="c-body">
            {dayTasks.length === 0 && <p className="hint2">这天没有任务截止，清爽。</p>}
            {dayTasks.map((t) => (
              <a className="ds-row" key={t.id} href={`/tasks?focus=${t.id}`} style={{ borderLeftColor: areaColor[t.area] }}>
                <b>{t.title}</b>
                <span>
                  {t.project || areaLabel[t.area]}
                  {t.priority === "high" ? " · 要紧" : ""}
                </span>
              </a>
            ))}

            <div className="ds-sec">空着的整块时间</div>
            {gaps.length === 0 && <p className="hint2">这天排得比较满，注意留白。</p>}
            {gaps.slice(0, 4).map((g) => (
              <button
                className="ds-gap"
                key={`${g.from}-${g.to}`}
                onClick={() => openNew(selected, g.from)}
                title="点这里把这个空档排上"
              >
                <span>{hhmm(g.from)}–{hhmm(g.to)}</span>
                <b>{Math.round((g.to - g.from) / 60 * 10) / 10} 小时</b>
              </button>
            ))}
          </div>
          <div className="ds-foot">
            <div>
              <b>{dayEvents.length}</b>
              <span>个日程</span>
            </div>
            <div>
              <b>
                {Math.round(
                  dayEvents.reduce((acc, e) => {
                    if (e.all_day || !e.end_at) return acc + 45;
                    return acc + Math.max(15, (parseISO(e.end_at).getTime() - parseISO(e.start_at).getTime()) / 60000);
                  }, 0) / 60
                )}
                h
              </b>
              <span>已占时间</span>
            </div>
          </div>
        </aside>
      )}
      </div>

      {dragTip && (
        <div className="cal2-tip" style={{ left: dragTip.x + 16, top: dragTip.y + 14 }}>
          <Clock size={10} /> {dragTip.text}
        </div>
      )}

      {draft && (
        <div className="modal" onClick={() => setDraft(null)}>
          <div className="sheet" style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button className="x" onClick={() => setDraft(null)}>×</button>
            <h3>{draft.mode === "edit" ? "编辑日程" : "新日程"}</h3>
            <p className="sub">{draft.mode === "edit" ? "改完直接保存。" : "先占住时间，比事后补记有用。"}</p>
            <div className="form">
              <label>
                标题
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="比如：客户周会" autoFocus />
              </label>
              <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={draft.allDay}
                  onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })}
                  style={{ width: 14, height: 14, accentColor: "#3AC8C2" }}
                />
                全天事件
              </label>
              <div className="two">
                <label>
                  开始
                  <input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
                </label>
                <label>
                  结束
                  <input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
                </label>
              </div>
              <label>
                地点
                <input value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} placeholder="可选" />
              </label>
              <label>
                备注
                <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="可选" />
              </label>
            </div>
            <div className="acts">
              {draft.mode === "edit" && (
                <button
                  className="b2 danger"
                  onClick={() => {
                    const ev = list.find((x) => x.id === draft.id);
                    if (ev) void del(ev);
                  }}
                >
                  <Trash2 size={11} style={{ verticalAlign: -1, marginRight: 4 }} />删除
                </button>
              )}
              <button className="b2" onClick={() => setDraft(null)}>取消</button>
              <button className="b1" onClick={save} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

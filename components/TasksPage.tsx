"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { endOfWeek, format, isBefore, isSameDay, isWithinInterval, parseISO, startOfDay, startOfWeek, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Check, ListChecks, Play, Plus, X } from "lucide-react";
import type { Task, Area, TaskStatus } from "@/lib/db";
import { useTasks } from "@/lib/use-tasks";
import { usePointerDrag } from "@/lib/use-pointer-drag";
import { useConfirm } from "./Confirm";
import { DragGhostLayer } from "./DragGhost";
import TopBar from "./TopBar";
import TaskModal from "./TaskModal";

const areaMeta: Record<Area, string> = { work: "工作", side: "副业", media: "自媒体", study: "学习", life: "生活" };
const cols = [
  { key: "todo", label: "待办", dot: "#5AA7E8" },
  { key: "doing", label: "进行中", dot: "#F6C453" },
  { key: "done", label: "完成", dot: "#3AC8C2" },
] as const;

export default function TasksPage({
  initial,
  projectList = [],
}: {
  initial: Task[];
  /** 任务弹窗里「项目」下拉用（真正的项目表） */
  projectList?: { id: number; name: string }[];
}) {
  const params = useSearchParams();
  const confirm = useConfirm();
  const { tasks, cycle, setStatus, remove, removeMany, setManyStatus, reorder } = useTasks(initial);
  const [area, setArea] = useState<Area | "all">("all");
  const [q, setQ] = useState("");
  const [due, setDue] = useState<"all" | "today" | "week" | "overdue">("all");
  const [project, setProject] = useState("all");
  const [modal, setModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [hoverCol, setHoverCol] = useState<TaskStatus | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);

  useEffect(() => {
    const id = params.get("focus");
    if (id) {
      const t = initial.find((x) => x.id === Number(id));
      if (t) setModal({ open: true, task: t });
    }
    if (params.get("new") === "1") setModal({ open: true, task: null });
  }, [params, initial]);

  const projects = useMemo(() => Array.from(new Set(initial.map((t) => t.project).filter(Boolean))), [initial]);
  const filtered = useMemo(() => {
    const now = new Date();
    return tasks.filter((t) => {
      if (area !== "all" && t.area !== area) return false;
      if (project !== "all" && t.project !== project) return false;
      if (q && !t.title.includes(q) && !(t.note || "").includes(q) && !(t.tags || "").includes(q)) return false;
      if (due !== "all") {
        if (!t.due_date || t.status === "done") return false;
        const d = parseISO(t.due_date);
        if (due === "today" && !isSameDay(d, now)) return false;
        if (due === "week" && !isWithinInterval(d, { start: startOfDay(now), end: endOfWeek(now, { weekStartsOn: 1 }) })) return false;
        if (due === "overdue" && !isBefore(d, startOfDay(now))) return false;
      }
      return true;
    });
  }, [tasks, area, q, due, project]);

  const { begin, ghost, didDrag } = usePointerDrag<{ task: Task }>(({ payload, x, y }) => {
    const el = document.elementFromPoint(x, y);
    const col = el?.closest("[data-status]") as HTMLElement | null;
    setHoverCol(null);
    const next = col?.dataset.status as TaskStatus | undefined;
    if (!next) return;

    // 拖到别的列 = 改状态
    if (next !== payload.task.status) {
      setStatus(payload.task, next);
      return;
    }

    // 拖回同一列 = 调顺序：看落点压在哪张卡上/下
    const card = el?.closest("[data-task-id]") as HTMLElement | null;
    const overId = card ? Number(card.dataset.taskId) : null;
    if (!overId || overId === payload.task.id) return;

    const ids = tasks.filter((t) => t.status === next).sort((a, b) => a.sort - b.sort).map((t) => t.id);
    const from = ids.indexOf(payload.task.id);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void reorder(next, ids);
  });

  const last7 = useMemo(() => {
    const d0 = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => subDays(d0, 6 - i));
  }, []);
  const last7Max = useMemo(
    () => Math.max(1, ...last7.map((d) => tasks.filter((t) => t.done_at && isSameDay(parseISO(t.done_at), d)).length)),
    [last7, tasks]
  );
  const recentDone = useMemo(
    () =>
      tasks
        .filter((t) => t.done_at)
        .sort((a, b) => (a.done_at! < b.done_at! ? 1 : -1))
        .slice(0, 4),
    [tasks]
  );

  const weekDoneCount = tasks.filter(
    (t) =>
      t.done_at &&
      isWithinInterval(parseISO(t.done_at), {
        start: startOfWeek(new Date(), { weekStartsOn: 1 }),
        end: endOfWeek(new Date(), { weekStartsOn: 1 }),
      })
  ).length;

  const openCount = tasks.filter((t) => t.status !== "done").length;
  const overdueCount = tasks.filter(
    (t) => t.status !== "done" && t.due_date && isBefore(parseISO(t.due_date), startOfDay(new Date()))
  ).length;

  const togglePick = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const exitPicking = () => {
    setPicking(false);
    setPicked([]);
  };

  const batchDone = async () => {
    await setManyStatus(picked, "done");
    exitPicking();
  };

  const batchRemove = async () => {
    const ok = await confirm({
      title: `删除这 ${picked.length} 件任务？`,
      desc: "删除后无法恢复。如果只是不想看了，可以先标记完成。",
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    await removeMany(picked);
    exitPicking();
  };

  return (
    <>
      <TopBar crumb="任务">
        <button
          className="ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
          onClick={() => (picking ? exitPicking() : setPicking(true))}
        >
          {picking ? <X size={12} /> : <ListChecks size={12} />}
          {picking ? "退出多选" : "多选"}
        </button>
        <button
          className="primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
          onClick={() => setModal({ open: true, task: null })}
        >
          <Plus size={12} />添加任务
        </button>
      </TopBar>
      <div className="tasks-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">TASKS · 任务面板</div>
          <h1>所有事，都在这里。</h1>
          <p>
            {openCount} 件待处理 · 共 {tasks.length} 件
            {overdueCount > 0 && <span style={{ color: "#D2795C" }}> · {overdueCount} 件已逾期</span>}
            {" · "}按住卡片拖到别的列，就能改状态
          </p>
        </div>
      </div>

      <div className="tstats">
        {[
          { k: "todo", label: "待在待办", cls: "todo" },
          { k: "doing", label: "正在做", cls: "doing" },
          { k: "done", label: "已完成", cls: "done" },
        ].map((s) => (
          <div className="tstat" key={s.k}>
            <span className={`tsi ${s.cls}`} />
            <div>
              <div className="tsl">{s.label}</div>
              <div className="tsv">{tasks.filter((t) => t.status === s.k).length}<small>件</small></div>
            </div>
          </div>
        ))}
        <div className="tstat">
          <span className="tsi late" />
          <div>
            <div className="tsl">已逾期</div>
            <div className="tsv" style={{ color: overdueCount ? "#C25E4A" : undefined }}>{overdueCount}<small>件</small></div>
          </div>
        </div>
      </div>

      <div className="filters">
        <button className={`chip ${area === "all" ? "on" : ""}`} onClick={() => setArea("all")}>全部</button>
        {(Object.keys(areaMeta) as Area[]).map((a) => (
          <button key={a} className={`chip ${area === a ? "on" : ""}`} onClick={() => setArea(a)}>{areaMeta[a]}</button>
        ))}
        <span style={{ width: 8 }} />
        <button className={`chip ${due === "today" ? "on" : ""}`} onClick={() => setDue(due === "today" ? "all" : "today")}>今天</button>
        <button className={`chip ${due === "week" ? "on" : ""}`} onClick={() => setDue(due === "week" ? "all" : "week")}>本周</button>
        <button className={`chip ${due === "overdue" ? "on" : ""}`} onClick={() => setDue(due === "overdue" ? "all" : "overdue")}>逾期</button>
        {projects.length > 0 && (
          <select value={project} onChange={(e) => setProject(e.target.value)} className="chip" style={{ padding: "4px 8px" }}>
            <option value="all">全部项目</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索任务…" style={{ marginLeft: "auto" }} />
      </div>

      {picking && (
        <div className="bulk-bar">
          <b>已选 {picked.length} 件</b>
          <button className="b-small" disabled={!picked.length} onClick={batchDone}>
            <Check size={10} style={{ verticalAlign: -1, marginRight: 3 }} />标记完成
          </button>
          <button
            className="b-small"
            disabled={!picked.length}
            onClick={() => setManyStatus(picked, "doing").then(exitPicking)}
          >
            <Play size={10} style={{ verticalAlign: -1, marginRight: 3 }} />设为进行中
          </button>
          <button className="b-small danger" disabled={!picked.length} onClick={batchRemove}>删除</button>
          <button
            className="b-small"
            onClick={() => setPicked(filtered.filter((t) => t.status !== "done").map((t) => t.id))}
          >
            全选未完成
          </button>
          <button className="b-small" onClick={() => setPicked([])}>清空选择</button>
        </div>
      )}

      <div className="kanban kanban-page">
        {cols.map((c) => {
          const list = filtered.filter((t) => t.status === c.key);
          return (
            <div
              className={`col ${hoverCol === c.key && ghost ? "drop-hot" : ""}`}
              key={c.key}
              data-status={c.key}
              onPointerMove={(e) => {
                if (ghost && hoverCol !== c.key) setHoverCol(c.key);
                void e;
              }}
              onPointerLeave={() => setHoverCol((h) => (h === c.key ? null : h))}
            >
              <div className="col-head">
                <span className="dot" style={{ background: c.dot }} />
                <b>{c.label}</b>
                <span className="n">{list.length}</span>
                <button onClick={() => setModal({ open: true, task: null })} aria-label="添加">＋</button>
              </div>
              {list.map((t) => (
                <div
                  className={`tcard ${t.status === "done" ? "done" : ""} ${picked.includes(t.id) ? "picked" : ""} ${ghost && dragId === t.id ? "lifted" : ""}`}
                  key={t.id}
                  data-task-id={t.id}
                  onPointerDown={(e) => {
                    if (picking) return;
                    const target = e.target as HTMLElement;
                    if (target.closest("button")) return;
                    setDragId(t.id);
                    begin(e, { task: t }, t.title, c.dot);
                  }}
                  onClick={() => {
                    if (didDrag.current) {
                      didDrag.current = false;
                      return;
                    }
                    if (picking) togglePick(t.id);
                    else setModal({ open: true, task: t });
                  }}
                >
                  <div className="ct">{t.title}</div>
                  <div className="cm">
                    <span
                      style={{
                        color:
                          t.due_date && t.status !== "done" && isBefore(parseISO(t.due_date), startOfDay(new Date()))
                            ? "#D2795C"
                            : undefined,
                      }}
                    >
                      {t.due_date ? format(parseISO(t.due_date), "M/d") : "随时"}
                    </span>
                    <span className="cat">{areaMeta[t.area]}</span>
                    {t.priority === "high" && <span style={{ color: "#D2795C" }}>· 要紧</span>}
                    {t.status === "doing" && <span style={{ color: "#A97C1B" }}>· 进行中</span>}
                  </div>
                  {!picking && t.status === "todo" && (
                    <button className="card-act" title="开始做" onClick={(e) => { e.stopPropagation(); setStatus(t, "doing"); }}>
                      <Play size={9} />
                    </button>
                  )}
                  {!picking && (
                    <button
                      className="check"
                      aria-label={t.status === "done" ? "退回待办" : "标记完成"}
                      onClick={(e) => { e.stopPropagation(); cycle(t); }}
                    >
                      ✓
                    </button>
                  )}
                  {picking && <span className="pick-dot">{picked.includes(t.id) ? "✓" : ""}</span>}
                </div>
              ))}
              {!list.length && (
                <div className="col-zone">
                  <span className="ec-drop" style={{ borderColor: c.dot }} />
                  {c.key === "todo" ? "把想到的事记到这里" : c.key === "doing" ? "正在做的，拖到这里" : "做完的，会落在这里"}
                </div>
              )}
              <button className="col-add" onClick={() => setModal({ open: true, task: null })}>＋ 添加{c.label}任务</button>
            </div>
          );
        })}
      </div>

      <div className="tasks-extra">
        <section className="card">
          <div className="c-head">
            <h2>最近七天收尾节奏</h2>
            <span className="sub">每天完成的任务数</span>
          </div>
          <div className="c-body">
            <div className="te-rows">
              {last7.map((d) => {
                const n = tasks.filter((t) => t.done_at && isSameDay(parseISO(t.done_at), d)).length;
                const pct = last7Max ? Math.max(n === 0 ? 0 : 8, Math.round((n / last7Max) * 100)) : 0;
                return (
                  <div
                    className={`te-line ${isSameDay(d, new Date()) ? "today" : ""} ${n === 0 ? "zero" : ""}`}
                    key={d.toISOString()}
                    title={`${format(d, "M月d日")} 完成 ${n} 件`}
                  >
                    <span className="dn">{format(d, "M/d EEE", { locale: zhCN })}</span>
                    <span className="tb"><i style={{ width: `${pct}%` }} /></span>
                    <span className="tn">{n ? `${n} 件` : "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="te-foot">
              <span>这周完成</span>
              <b>{weekDoneCount}</b>
              <span>件 · 近七天平均每天</span>
              <b>{(last7.reduce((a, d) => a + tasks.filter((t) => t.done_at && isSameDay(parseISO(t.done_at), d)).length, 0) / 7).toFixed(1)}</b>
              <span>件</span>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="c-head">
            <h2>刚刚做完的</h2>
            <span className="sub">最近完成</span>
          </div>
          <div className="c-body">
            <div className="te-done">
              {recentDone.length === 0 && <div className="te-empty">还没有完成的任务，先挑一件小的开始</div>}
              {recentDone.map((t) => (
                <div className="te-row" key={t.id}>
                  <span className="tk">✓</span>
                  <b>{t.title}</b>
                  <span>{t.done_at ? format(parseISO(t.done_at), "M/d HH:mm") : ""}</span>
                </div>
              ))}
            </div>
            {recentDone.length < 3 && (
              <div className="te-hint">
                <b>节奏是靠小事带起来的</b>
                <span>挑一件 10 分钟能收尾的，先划掉它</span>
              </div>
            )}
            <div className="te-foot">
              <span>累计完成</span>
              <b>{tasks.filter((t) => t.status === "done").length}</b>
              <span>件 · 还有</span>
              <b>{openCount}</b>
              <span>件在路上</span>
            </div>
          </div>
        </section>
      </div>
      </div>

      <DragGhostLayer ghost={ghost} />
      <TaskModal
        open={modal.open}
        task={modal.task}
        onClose={() => setModal({ open: false, task: null })}
        onDelete={remove}
        projects={projectList}
      />
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban, Check, Archive, Trash2, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Task, Area } from "@/lib/db";
import { api, errText } from "@/lib/api";
import Select from "./Select";
import DateField from "./DateField";
import { useToast } from "./Toast";
import { useConfirm } from "./Confirm";
import TopBar from "./TopBar";

export type Project = {
  id: number;
  name: string;
  color: string;
  area: string;
  status: string;
  note: string;
  sort: number;
  created_at: string;
  target_date?: string | null;
  total: number;
  done: number;
};

const areaMeta: Record<string, string> = { work: "工作", side: "副业", media: "自媒体", study: "学习", life: "生活" };
const palette = ["#9B8AE6", "#4FD3C8", "#F6C453", "#5AA7E8", "#F0897B", "#8FCB9B"];

const blankDraft = { name: "", color: palette[0], area: "work" as Area, note: "", target_date: "" };

/** 距目标日期还有几天。已过期返回负数。 */
function daysLeft(target?: string | null) {
  if (!target) return null;
  const d = new Date(target.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default function ProjectsApp({
  initial,
  tasks,
  notes = [],
  weekDone = {},
}: {
  initial: Project[];
  tasks: Task[];
  /** 挂在项目下的记录（显示「最近动静」） */
  notes?: { id: number; title: string; project_id: number | null; updated_at: string }[];
  /** 本周完成数（按项目 id） */
  weekDone?: Record<number, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState<Project[]>(() => initial.map((p) => ({ ...p })));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [draft, setDraft] = useState({ ...blankDraft });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => setList(initial.map((p) => ({ ...p }))), [initial]);

  // 每个项目下的任务（按项目 id 分组，未归属项目的放最后）
  const byProject = useMemo(() => {
    const m = new Map<number, Task[]>();
    for (const t of tasks) {
      if (!t.project_id) continue;
      const arr = m.get(t.project_id) ?? [];
      arr.push(t);
      m.set(t.project_id, arr);
    }
    return m;
  }, [tasks]);

  const unassigned = useMemo(() => tasks.filter((t) => !t.project_id), [tasks]);

  /* 项目页里直接勾完成。改的是服务器上的任务状态，本地 state 也要跟上。 */
  const toggleTask = async (t: Task) => {
    const next = t.status === "done" ? "todo" : "done";
    try {
      await api(`/api/tasks/${t.id}`, { method: "PATCH", body: { status: next } });
      toast(next === "done" ? `「${t.title}」完成了` : `「${t.title}」退回了待办`);
      router.refresh();
    } catch (e) {
      toast(errText(e, "没保存上"));
    }
  };

  const startNew = () => {
    setEditing(null);
    setDraft({ ...blankDraft, color: palette[list.length % palette.length] });
    setErr("");
    setOpen(true);
  };

  const startEdit = (p: Project) => {
    setEditing(p);
    setDraft({ name: p.name, color: p.color, area: p.area as Area, note: p.note ?? "", target_date: p.target_date?.slice(0, 10) ?? "" });
    setErr("");
    setOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) return setErr("给项目起个名字吧");
    setBusy(true);
    setErr("");
    try {
      if (editing) {
        const d = await api<{ project: Project }>(`/api/projects/${editing.id}`, {
          method: "PATCH",
          body: { ...draft, target_date: draft.target_date || null },
        });
        setList((l) => l.map((p) => (p.id === editing.id ? { ...p, ...d.project } : p)));
        toast("项目已更新");
      } else {
        const d = await api<{ project: Project }>("/api/projects", {
          method: "POST",
          body: { ...draft, target_date: draft.target_date || null },
        });
        setList((l) => [...l, { ...d.project, total: 0, done: 0 }]);
        toast(`「${draft.name}」建好了`);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(errText(e, "保存失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Project) => {
    const ok = await confirm({
      title: "删除这个项目？",
      desc: `「${p.name}」会被删掉。下面的 ${p.total} 件任务不会跟着删，只是不再属于任何项目。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/projects/${p.id}`, { method: "DELETE" });
    } catch (e) {
      toast(errText(e, "删除失败，项目还在"));
      return;
    }
    setList((l) => l.filter((x) => x.id !== p.id));
    if (activeId === p.id) setActiveId(null);
    router.refresh();
    toast(`已删除「${p.name}」`);
  };

  const toggleArchive = async (p: Project) => {
    const next = p.status === "archived" ? "active" : "archived";
    try {
      await api(`/api/projects/${p.id}`, { method: "PATCH", body: { status: next } });
      setList((l) => l.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
      toast(next === "archived" ? "已归档" : "已恢复");
      router.refresh();
    } catch (e) {
      toast(errText(e, "操作失败"));
    }
  };

  const active = list.filter((p) => p.status !== "archived");
  const archived = list.filter((p) => p.status === "archived");

  const card = (p: Project) => {
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    const isOpen = activeId === p.id;
    const its = byProject.get(p.id) ?? [];
    const left = daysLeft(p.target_date);
    const wd = weekDone[p.id] ?? 0;
    const pNotes = notes.filter((n) => n.project_id === p.id).slice(0, 3);
    return (
      <div className={`pj-card ${isOpen ? "open" : ""}`} key={p.id}>
        <div className="pj-top" onClick={() => setActiveId(isOpen ? null : p.id)}>
          <span className="pj-dot" style={{ background: p.color }} />
          <div className="pj-meta">
            <b>{p.name}</b>
            <span>
              {areaMeta[p.area] ?? p.area} · {p.total} 件任务
              {wd > 0 && <> · 本周完成 <em className="pj-week">{wd}</em></>}
            </span>
          </div>
          <div className="pj-pct">{pct}%</div>
        </div>
        {left !== null && (
          <div className={`pj-due ${left < 0 ? "over" : left <= 3 ? "soon" : ""}`}>
            {left < 0 ? `已超期 ${-left} 天` : left === 0 ? "就是今天" : `还剩 ${left} 天`}
            {p.target_date ? <em>{p.target_date.slice(0, 10)}</em> : null}
          </div>
        )}
        <div className="pj-bar">
          <i style={{ width: `${pct}%`, background: p.color }} />
        </div>
        {p.note ? <p className="pj-note">{p.note}</p> : null}
        <div className="pj-acts">
          <button onClick={() => startEdit(p)}><Pencil size={11} />编辑</button>
          <button onClick={() => toggleArchive(p)}><Archive size={11} />{p.status === "archived" ? "恢复" : "归档"}</button>
          <button className="danger" onClick={() => remove(p)}><Trash2 size={11} />删除</button>
        </div>
        {isOpen && (
          <>
            <div className="pj-tasks">
              {its.length === 0 && <p className="pj-empty">这个项目还没有任务。去任务面板把任务归到它下面。</p>}
              {its.map((t) => (
                <div className={`pj-task ${t.status === "done" ? "done" : ""}`} key={t.id}>
                  {/* 项目页里直接勾完成，不用跳回任务面板 */}
                  <button
                    className={`pj-tick ${t.status === "done" ? "on" : ""}`}
                    onClick={() => void toggleTask(t)}
                    aria-label={t.status === "done" ? "标记未完成" : "标记完成"}
                  >
                    {t.status === "done" ? <Check size={9} /> : null}
                  </button>
                  <b>{t.title}</b>
                  {t.due_date ? <em>{format(parseISO(t.due_date), "M/d")}</em> : null}
                </div>
              ))}
            </div>
            {pNotes.length > 0 && (
              <div className="pj-notes">
                <div className="pj-notes-head">最近记下的</div>
                {pNotes.map((n) => (
                  <div className="pj-note-row" key={n.id}>
                    <span>{n.title || "未命名记录"}</span>
                    <em>{format(parseISO(n.updated_at), "M/d")}</em>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <TopBar crumb="项目进度">
        <button className="primary" onClick={startNew}>
          <Plus size={13} style={{ verticalAlign: -2, marginRight: 4 }} />新建项目
        </button>
      </TopBar>

      <div className="page-head">
        <div>
          <div className="eyebrow">PROJECTS · 项目进度</div>
          <h1>手上的事，分成几摊。</h1>
          <p>每个项目一个进度条，做久了能看出哪摊在推进、哪摊在拖。</p>
        </div>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <div className="pj-hero">
          <FolderKanban size={26} />
          <b>还没有项目</b>
          <p>把相关的任务归到一个项目里，比如「个人工作台上线」「11 月副业」。<br />点右上角「新建项目」开始。</p>
          <button className="primary" onClick={startNew}>
            <Plus size={13} style={{ verticalAlign: -2, marginRight: 4 }} />新建第一个项目
          </button>
        </div>
      ) : (
        <>
          <div className="pj-grid">{active.map(card)}</div>
          {archived.length > 0 && (
            <>
              <div className="pj-sec">已归档</div>
              <div className="pj-grid dim">{archived.map(card)}</div>
            </>
          )}
          {unassigned.length > 0 && (
            <p className="pj-hint">
              还有 {unassigned.length} 件任务没归到项目里。在任务面板编辑任务时选一下项目就行。
            </p>
          )}
        </>
      )}

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button className="x" onClick={() => setOpen(false)} aria-label="关闭">×</button>
            <h3>{editing ? "编辑项目" : "新建项目"}</h3>
            <p className="sub">{editing ? "改完直接保存。" : "起个名字，颜色随便挑一个。"}</p>
            <div className="form">
              <label>
                项目名字
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="比如：个人工作台上线"
                />
              </label>
              <label>
                属于哪块
                <Select
                  ariaLabel="属于哪块"
                  value={draft.area}
                  onChange={(v) => setDraft({ ...draft, area: v as Area })}
                  options={Object.entries(areaMeta).map(([k, v]) => ({ value: k, label: v }))}
                />
              </label>
              <label>
                颜色
                <div className="pj-colors">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`pj-color ${draft.color === c ? "on" : ""}`}
                      style={{ background: c }}
                      onClick={() => setDraft({ ...draft, color: c })}
                      aria-label={`颜色 ${c}`}
                    />
                  ))}
                </div>
              </label>
              <label>
                想什么时候做完
                <DateField
                  mode="date"
                  value={draft.target_date}
                  onChange={(v) => setDraft({ ...draft, target_date: v })}
                  placeholder="可选，填了会显示还剩几天"
                />
              </label>
              <label>
                备注
                <input
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="可选，一句话说清这个项目要到什么程度"
                />
              </label>
            </div>
            {err ? <div className="form-err">{err}</div> : null}
            <div className="acts">
              {editing && (
                <button className="b2 danger" onClick={() => { const p = editing; setOpen(false); void remove(p); }}>
                  <Trash2 size={11} style={{ verticalAlign: -1, marginRight: 4 }} />删除
                </button>
              )}
              <button className="b1" onClick={save} disabled={busy}>
                {busy ? "保存中…" : editing ? "保存修改" : "建好"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Task, Area, Priority, TaskStatus } from "@/lib/db";
import DateField from "./DateField";
import { useConfirm } from "./Confirm";
import { useToast } from "./Toast";
import { api, errText } from "@/lib/api";

const areas: { v: Area; label: string }[] = [
  { v: "work", label: "工作" },
  { v: "side", label: "副业" },
  { v: "media", label: "自媒体" },
  { v: "study", label: "学习" },
  { v: "life", label: "生活" },
];

export default function TaskModal({
  open,
  onClose,
  task,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  onDelete?: (task: Task) => void | Promise<void>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [err, setErr] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [area, setArea] = useState<Area>("work");
  const [priority, setPriority] = useState<Priority>("med");
  const [due, setDue] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [estimate, setEstimate] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setTitle(task?.title ?? "");
    setNote(task?.note ?? "");
    setArea(task?.area ?? "work");
    setPriority(task?.priority ?? "med");
    setDue(task?.due_date?.slice(0, 10) ?? "");
    setStart(task?.scheduled_start?.slice(0, 16) ?? "");
    setEnd(task?.scheduled_end?.slice(0, 16) ?? "");
    setEstimate(task?.estimate_min ? String(task.estimate_min) : "");
    setProject(task?.project ?? "");
    setStatus(task?.status ?? "todo");
    setTags(task?.tags ?? "");
  }, [open, task]);

  if (!open) return null;

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      note,
      area,
      priority,
      due_date: due || null,
      scheduled_start: start || null,
      scheduled_end: end || null,
      estimate_min: estimate ? Number(estimate) : null,
      project,
      tags,
      status,
    };
    try {
      await api(task ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: task ? "PATCH" : "POST",
        body: payload,
      });
      toast(task ? "任务已更新" : "任务已添加");
      router.refresh();
      onClose();
    } catch (e) {
      // 以前这里没有 catch：保存失败时弹窗直接关掉，用户以为存上了
      setErr(errText(e, "保存失败，请重试"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!task) return;
    const ok = await confirm({
      title: "删除这条任务？",
      desc: `「${task.title}」会被移除，删除后无法恢复。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    try {
      if (onDelete) await onDelete(task);
      else await api(`/api/tasks/${task.id}`, { method: "DELETE" });
    } catch (e) {
      // 以前删失败也会关弹窗，看着像删掉了
      setErr(errText(e, "删除失败，任务还在"));
      return;
    }
    onClose();
    if (!onDelete) router.refresh();
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="关闭">×</button>
        <h3>{task ? "编辑任务" : "添加任务"}</h3>
        <p className="sub">{task ? "改完直接保存，不用刷新。" : "先记下来，细节以后再补也可以。"}</p>
        <div className="form">
          <label>
            任务
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="比如：把周报写完发出去" autoFocus />
          </label>
          <label>
            备注
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
          </label>
          <div className="two">
            <label>
              分类
              <select value={area} onChange={(e) => setArea(e.target.value as Area)}>
                {areas.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </label>
            <label>
              优先级
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                <option value="high">高</option>
                <option value="med">中</option>
                <option value="low">低</option>
              </select>
            </label>
          </div>
          <div className="two">
            <label>
              项目
              <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="比如：客户 A / 小红书" />
            </label>
            <label>
              标签
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="用逗号分隔" />
            </label>
          </div>
          <label>
            状态
            <div className="seg">
              {([
                ["todo", "待办"],
                ["doing", "进行中"],
                ["done", "已完成"],
              ] as [TaskStatus, string][]).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={`seg-btn ${status === v ? "on" : ""}`}
                  onClick={() => setStatus(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
          <div className="two">
            <label>
              截止日期
              <DateField value={due} onChange={setDue} />
            </label>
            <label>
              预计分钟
              <input type="number" value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="可选" />
            </label>
          </div>
          <div className="two">
            <label>
              安排开始
              <DateField mode="datetime" value={start} onChange={setStart} />
            </label>
            <label>
              安排结束
              <DateField mode="datetime" value={end} onChange={setEnd} />
            </label>
          </div>
        </div>
        {err ? <div className="form-err">{err}</div> : null}
        <div className="acts">
          {task && <button className="b2 danger" onClick={remove}>删除</button>}
          <button className="b2" onClick={onClose}>取消</button>
          <button className="b1" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}

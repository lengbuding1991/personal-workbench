"use client";

import { useState } from "react";
import { Check, Flame, Pencil, Plus, Trash2 } from "lucide-react";
import TopBar from "./TopBar";
import { useToast } from "./Toast";
import { useConfirm } from "./Confirm";
import { api, errText } from "@/lib/api";
import type { HabitView } from "@/lib/habits";

type Payload = { today: string; days: string[]; habits: HabitView[] };

/** 新习惯按顺序取色，不用用户自己挑 */
const PALETTE = ["#3AC8C2", "#5AA7E8", "#A78BFA", "#F5AE8E", "#F6C453", "#6FD6BE"];

export default function HabitsApp({
  initial,
  initialToday,
  initialDays,
}: {
  initial: HabitView[];
  initialToday: string;
  initialDays: string[];
}) {
  const [habits, setHabits] = useState<HabitView[]>(initial);
  const [days, setDays] = useState<string[]>(initialDays);
  const [today, setToday] = useState(initialToday);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null);
  const toast = useToast();
  const ask = useConfirm();

  const doneCount = habits.filter((h) => h.doneToday).length;
  const bestStreak = habits.reduce((n, h) => Math.max(n, h.streak), 0);

  function sync(p: Partial<Payload>) {
    if (p.habits) setHabits(p.habits);
    if (p.days) setDays(p.days);
    if (p.today) setToday(p.today);
  }

  /** 先改界面再发请求：勾一下要立刻有反馈，失败了再退回去 */
  function optimistic(h: HabitView, date: string, wasOn: boolean): HabitView {
    const logs = wasOn ? h.logs.filter((d) => d !== date) : [...h.logs, date].sort();
    return {
      ...h,
      logs,
      weekDone: days.filter((d) => logs.includes(d)).length,
      doneToday: date === today ? !wasOn : h.doneToday,
      streak: date === today ? Math.max(0, h.streak + (wasOn ? -1 : 1)) : h.streak,
    };
  }

  async function toggle(h: HabitView, date: string) {
    const wasOn = h.logs.includes(date);
    const before = habits;
    setHabits(habits.map((x) => (x.id === h.id ? optimistic(x, date, wasOn) : x)));
    try {
      const res = await api<Payload & { done: boolean }>("/api/habits/log", {
        method: "POST",
        body: { habit_id: h.id, date },
      });
      sync(res);
      if (date === today && res.done && res.habits.length > 0 && res.habits.every((x) => x.doneToday)) {
        toast("今天全部打完了，漂亮");
      }
    } catch (e) {
      setHabits(before);
      toast(errText(e));
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const res = await api<Payload>("/api/habits", {
        method: "POST",
        body: { name: n, color: PALETTE[habits.length % PALETTE.length] },
      });
      sync(res);
      setName("");
    } catch (err) {
      toast(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(h: HabitView) {
    setEditing({ id: h.id, value: h.name });
  }

  async function saveEdit() {
    if (!editing) return;
    const id = editing.id;
    const value = editing.value.trim();
    const current = habits.find((h) => h.id === id);
    setEditing(null);
    if (!value || !current || value === current.name) return;
    // 先本地改名，失败再拉回来
    setHabits(habits.map((h) => (h.id === id ? { ...h, name: value } : h)));
    try {
      const res = await api<Payload>(`/api/habits/${id}`, { method: "PATCH", body: { name: value } });
      sync(res);
    } catch (err) {
      toast(errText(err));
      setHabits(habits);
    }
  }

  async function remove(h: HabitView) {
    const ok = await ask({
      title: "删除这个习惯？",
      desc: `「${h.name}」和它的打卡记录会一起删掉，不能恢复。`,
      danger: true,
      confirmText: "删除",
    });
    if (!ok) return;
    try {
      const res = await api<Payload>(`/api/habits/${h.id}`, { method: "DELETE" });
      sync(res);
      toast("已删除");
    } catch (err) {
      toast(errText(err));
    }
  }

  return (
    <>
      <TopBar crumb="每日习惯" />
      <div className="page-head">
        <div>
          <div className="eyebrow">HABITS · 每日习惯</div>
          <h1>每天做一点，就算数。</h1>
          <p>只记今天做没做，连续天数自己会数。</p>
        </div>
      </div>

      <section className="card hb-sum">
        <div className="hb-sum-num">
          <b>{doneCount}</b>
          <span>/ {habits.length}</span>
        </div>
        <div className="hb-sum-mid">
          <div className="hb-sum-label">
            {habits.length === 0
              ? "还没有习惯"
              : doneCount === habits.length
                ? "今天全部完成"
                : `今天还差 ${habits.length - doneCount} 个`}
          </div>
          <div className="hb-bar">
            <i style={{ width: `${habits.length ? (doneCount / habits.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="hb-sum-best">
          <Flame size={12} />
          <span>最长 {bestStreak} 天</span>
        </div>
      </section>

      <form className="hb-add" onSubmit={add}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="加一个习惯，比如：喝水、读 10 页书、11 点前睡"
          maxLength={40}
          aria-label="新习惯名称"
        />
        <button className="b1" type="submit" disabled={!name.trim() || busy}>
          <Plus size={13} /> 添加
        </button>
      </form>

      {habits.length === 0 ? (
        <div className="hb-empty">
          <b>先加一个最小的</b>
          <span>小到不好意思不做，比如「喝一杯水」。做满一周再加下一个。</span>
        </div>
      ) : (
        <div className="hb-list">
          {habits.map((h) => (
            <div className={`hb-row ${h.doneToday ? "done" : ""}`} key={h.id}>
              <div className="hb-line">
                <button
                  className="hb-check"
                  onClick={() => toggle(h, today)}
                  aria-pressed={h.doneToday}
                  aria-label={`${h.name} 今天${h.doneToday ? "已完成，点击取消" : "还没完成，点击打卡"}`}
                  style={h.doneToday ? { background: h.color, borderColor: h.color } : undefined}
                >
                  {h.doneToday && <Check size={15} strokeWidth={3} />}
                </button>

                {editing?.id === h.id ? (
                  <input
                    className="hb-name-edit"
                    autoFocus
                    value={editing.value}
                    maxLength={40}
                    onChange={(e) => setEditing({ id: h.id, value: e.target.value })}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <b className="hb-name" onDoubleClick={() => startEdit(h)}>
                    {h.name}
                  </b>
                )}

                <div className="hb-acts">
                  <button className="hb-ico" onClick={() => startEdit(h)} aria-label={`改「${h.name}」的名字`}>
                    <Pencil size={12} />
                  </button>
                  <button className="hb-ico danger" onClick={() => remove(h)} aria-label={`删除「${h.name}」`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="hb-line2">
                <span className={`hb-streak ${h.streak ? "" : "off"}`}>
                  <Flame size={11} />
                  {h.streak ? `连续 ${h.streak} 天` : "还没连上"}
                </span>
                <span className="hb-week">本周 {h.weekDone}/7</span>
                <div className="hb-days">
                  {days.map((d) => {
                    const on = h.logs.includes(d);
                    return (
                      <button
                        key={d}
                        className={`hb-dot ${on ? "on" : ""} ${d === today ? "today" : ""}`}
                        style={on ? { background: h.color, borderColor: h.color } : undefined}
                        onClick={() => toggle(h, d)}
                        title={`${d.slice(5)} ${on ? "已打卡，点击取消" : "未打卡，点击补上"}`}
                        aria-label={`${h.name} ${d} ${on ? "已打卡" : "未打卡"}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="hb-tip">连续天数在今天还没打卡时从昨天算起，断一天就重新数。点小圆点可以补最近 7 天。</p>
    </>
  );
}

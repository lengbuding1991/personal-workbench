"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errText } from "@/lib/api";
import { format, parseISO, addDays } from "date-fns";
import { Sparkles, Trash2 } from "lucide-react";
import type { Review } from "@/lib/db";
import TopBar from "./TopBar";
import { useConfirm } from "./Confirm";

export default function ReviewApp({
  today,
  weeklyKey,
  daily,
  weekly,
  history,
  aiReady,
  doneThisWeek,
  notesThisWeek,
  weekDone = [],
}: {
  today: string;
  weeklyKey: string;
  daily: Review | null;
  weekly: Review | null;
  history: Review[];
  aiReady: boolean;
  doneThisWeek: number;
  notesThisWeek: number;
  /** 本周完成的任务明细（周复盘用，列出来才知道完成了什么） */
  weekDone?: { id: number; title: string; done_at: string; area: string }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [type, setType] = useState<"daily" | "weekly">("daily");
  const [did, setDid] = useState("");
  const [stuck, setStuck] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [msg, setMsg] = useState("");
  const didRef = useRef<HTMLTextAreaElement | null>(null);
  // 删完立刻从列表里拿掉，不用等整页刷新；props 变了再同步回来
  const [items, setItems] = useState<Review[]>(history);
  useEffect(() => setItems(history), [history]);

  useEffect(() => {
    const src = type === "daily" ? daily : weekly;
    // 周复盘的自动汇总只是「起个头」，不算用户写了内容 —— 否则什么都不填
    // 也能通过空校验。所以预览区展示它，但不预填进输入框。
    setDid(src?.did ?? "");
    setStuck(src?.stuck ?? "");
    setTomorrow(src?.tomorrow ?? "");
    setSummary(src?.summary ?? "");
    setMsg("");
  }, [type, daily, weekly, doneThisWeek, notesThisWeek]);

  const dateKey = type === "daily" ? today : weeklyKey;

  // 四个框全空就没有保存的意义。以前什么都不填也能存，
  // 历史里就会出现一条「（空白）」的复盘，看着像坏了。
  const isEmpty = !did.trim() && !stuck.trim() && !tomorrow.trim() && !summary.trim();

  const save = async () => {
    if (isEmpty) {
      setMsg("写一句再保存吧");
      didRef.current?.focus();
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await api("/api/reviews", {
        method: "POST",
        body: { date: dateKey, type, did, stuck, tomorrow, summary },
      });
      setMsg("已保存");
      router.refresh();
    } catch (e) {
      setMsg(errText(e, "保存失败，请重试"));
    } finally {
      setSaving(false);
    }
  };

  /** 删掉一篇历史复盘。写错的东西得能清掉，否则会一直挂在历史里。 */
  const removeReview = async (r: Review) => {
    const ok = await confirm({
      title: "删除这篇复盘？",
      desc: `${r.date} 的${r.type === "weekly" ? "周" : "日"}复盘会被永久删除，没法恢复。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/reviews", { method: "DELETE", body: { id: r.id } });
    } catch (e) {
      setMsg(errText(e, "删除失败，这篇还在"));
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    // 如果删的正好是当前正在编辑的那篇，把表单里的内容也清掉
    const key = r.type === "weekly" ? weeklyKey : today;
    if (r.date === key && r.type === type) {
      setDid("");
      setStuck("");
      setTomorrow("");
      setSummary("");
    }
    setMsg("已删除这篇复盘");
    router.refresh();
  };

  const draft = async () => {
    setDrafting(true);
    setMsg("");
    try {
      const data = await api<{ did?: string; stuck?: string; tomorrow?: string }>("/api/ai", {
        method: "POST",
        body: { action: "review", date: dateKey, type },
      });
      if (data.did) setDid(data.did);
      if (data.stuck) setStuck(data.stuck);
      if (data.tomorrow) setTomorrow(data.tomorrow);
      setMsg("AI 已起稿，改完记得保存");
    } catch (e) {
      setMsg(errText(e, "AI 起稿失败"));
    } finally {
      setDrafting(false);
    }
  };

  const labels = type === "daily"
    ? { did: "今天做成了什么？", stuck: "哪里卡住了？", next: "明天最重要的一件事？", ph1: "哪怕很小的一件事…", ph2: "写下来，明天绕开。", ph3: "只写一件。" }
    : { did: "本周做成了什么？", stuck: "这周卡在哪里？", next: "下周最重要的一件事？", ph1: "把完成的事拢一拢…", ph2: "下周想绕开什么？", ph3: "只写一件。" };

  const list = items.filter((r) => r.type === type);

  /*
   * 「明天最重要的一件事」写完就该变成一件真事，而不是停在复盘文本里。
   * 所以第 03 问下面放一个按钮，一键把它存成任务（截止日 = 明天）。
   */
  const [toTaskBusy, setToTaskBusy] = useState(false);
  const [toTaskMsg, setToTaskMsg] = useState("");
  const makeTask = async () => {
    const text = tomorrow.trim();
    if (!text) {
      setToTaskMsg("先写一件再存");
      return;
    }
    setToTaskBusy(true);
    setToTaskMsg("");
    try {
      const due = format(addDays(new Date(), 1), "yyyy-MM-dd");
      await api("/api/tasks", {
        method: "POST",
        body: { title: text.slice(0, 80), note: `来自${type === "daily" ? "日" : "周"}复盘 ${today}`, due_date: due, area: "work", priority: "high" },
      });
      setToTaskMsg("已存成任务，截止明天");
      setTomorrow("");
      router.refresh();
    } catch (e) {
      setToTaskMsg(errText(e, "没存上，稍后再试"));
    } finally {
      setToTaskBusy(false);
    }
  };

  return (
    <>
      <TopBar crumb="复盘">
        <button className="ghost" onClick={draft} disabled={drafting}>
          <Sparkles size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          {drafting ? "起稿中…" : "AI 起稿"}
        </button>
        <button className="primary" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存复盘"}</button>
      </TopBar>

      <div className="page-head">
        <div>
          <div className="eyebrow">REVIEW · {type === "daily" ? format(new Date(today), "yyyy.MM.dd") : `${weeklyKey} 周`}</div>
          <h1>{type === "daily" ? "今天，留下了什么？" : "这一周，走到了哪里？"}</h1>
          <p>{type === "daily" ? "三个问题，30 秒。写给明天的自己看。" : `自动汇总：本周完成 ${doneThisWeek} 件任务，写下 ${notesThisWeek} 条记录。`}</p>
        </div>
        <div className="right">
          <button className={`chip ${type === "daily" ? "on" : ""}`} onClick={() => setType("daily")}>日复盘</button>
          <button className={`chip ${type === "weekly" ? "on" : ""}`} onClick={() => setType("weekly")}>周复盘</button>
        </div>
      </div>

      <div className="review-grid">
        <section className="card review-card">
          <h2>{type === "daily" ? "今日复盘" : "本周复盘"}</h2>
          <p className="sub">
            {type === "daily" ? "不用写长，写具体就好。" : "本周完成的情况见下方统计，从这里开始写。"}
            {aiReady ? "" : "（配置 AI Key 后可一键起稿）"}
          </p>

          {type === "weekly" && (
            <>
              <div className="rv-autosum">
                本周自动统计：完成 <b>{doneThisWeek}</b> 件任务，留下 <b>{notesThisWeek}</b> 条记录。
              </div>
              {/* 明细。以前只有两个数字，看不出这周到底完成了哪几件事。 */}
              {weekDone.length > 0 && (
                <details className="rv-detail">
                  <summary>看看这周完成了哪 {weekDone.length} 件事</summary>
                  <ul>
                    {weekDone.map((t) => (
                      <li key={t.id}>
                        <span className="rv-done-at">{format(parseISO(t.done_at), "M/d")}</span>
                        <span className="rv-done-title">{t.title}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          <div className="review-q">
            <label><b>01</b> {labels.did}</label>
            <textarea ref={didRef} value={did} onChange={(e) => setDid(e.target.value)} placeholder={labels.ph1} />
          </div>
          <div className="review-q">
            <label><b>02</b> {labels.stuck}</label>
            <textarea value={stuck} onChange={(e) => setStuck(e.target.value)} placeholder={labels.ph2} />
          </div>
          <div className="review-q">
            <label><b>03</b> {labels.next}</label>
            <textarea value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} placeholder={labels.ph3} />
            <div className="rv-totask">
              <button className="b2" onClick={makeTask} disabled={toTaskBusy}>
                {toTaskBusy ? "存着…" : "存成任务"}
              </button>
              <span className="hint2">截止日设为明天</span>
              {toTaskMsg && <span className="hint2 rv-totask-msg">{toTaskMsg}</span>}
            </div>
          </div>
          <div className="review-q">
            <label>一句话总结（可选）</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="给这段一个句号。" style={{ minHeight: 54 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="b1" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存复盘"}</button>
            <button className="b2" onClick={draft} disabled={drafting}>{drafting ? "起稿中…" : "让 AI 起稿"}</button>
            {msg && <span className="hint2">{msg}</span>}
          </div>
        </section>

        <section className="card history">
          <h3>最近{type === "daily" ? "日" : "周"}复盘</h3>
          <p className="hint2" style={{ margin: "0 0 6px" }}>回头看，才知道自己走了多远。</p>
          {list.length === 0 ? (
            <div className="history-empty">
              <div>
                <b>还没有{type === "daily" ? "日" : "周"}复盘</b>
                <p>从左边这几行开始，30 秒就够。</p>
                <button className="b2" onClick={() => didRef.current?.focus()}>开始写第一条</button>
              </div>
            </div>
          ) : (
            <div className="history-list">
              {list.map((r) => (
                <div className="item" key={r.id}>
                  <b>{r.date} · {r.type === "weekly" ? "周复盘" : "日复盘"}</b>
                  <button
                    className="rv-del"
                    onClick={() => void removeReview(r)}
                    title="删除这篇"
                    aria-label={`删除 ${r.date} 的复盘`}
                  >
                    <Trash2 size={12} />
                  </button>
                  <p>{r.summary || r.did || <em className="rv-blank">这篇没写内容</em>}</p>
                </div>
              ))}
              {list.length < 4 && (
                <div className="history-tip">
                  <span>再写 {4 - list.length} 次，这里就满起来了</span>
                </div>
              )}
            </div>
          )}
          <div className="history-foot">
            <div><span>本周完成任务</span><b>{doneThisWeek}</b></div>
            <div><span>本周写下的记录</span><b>{notesThisWeek}</b></div>
          </div>
        </section>
      </div>
    </>
  );
}

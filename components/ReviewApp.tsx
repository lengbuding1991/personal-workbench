"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errText } from "@/lib/api";
import { format } from "date-fns";
import { Sparkles } from "lucide-react";
import type { Review } from "@/lib/db";
import TopBar from "./TopBar";

export default function ReviewApp({
  today,
  weeklyKey,
  daily,
  weekly,
  history,
  aiReady,
  doneThisWeek,
  notesThisWeek,
}: {
  today: string;
  weeklyKey: string;
  daily: Review | null;
  weekly: Review | null;
  history: Review[];
  aiReady: boolean;
  doneThisWeek: number;
  notesThisWeek: number;
}) {
  const router = useRouter();
  const [type, setType] = useState<"daily" | "weekly">("daily");
  const [did, setDid] = useState("");
  const [stuck, setStuck] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [msg, setMsg] = useState("");
  const didRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const src = type === "daily" ? daily : weekly;
    setDid(src?.did ?? (type === "weekly" ? `本周完成 ${doneThisWeek} 件任务，留下 ${notesThisWeek} 条记录。` : ""));
    setStuck(src?.stuck ?? "");
    setTomorrow(src?.tomorrow ?? "");
    setSummary(src?.summary ?? "");
    setMsg("");
  }, [type, daily, weekly, doneThisWeek, notesThisWeek]);

  const dateKey = type === "daily" ? today : weeklyKey;

  const save = async () => {
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

  const list = history.filter((r) => r.type === type);

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
          <p>{type === "daily" ? "三个问题，30 秒。写给明天的自己看。" : `自动汇总：本周完成 ${doneThisWeek} 件任务，留下 ${notesThisWeek} 条记录。`}</p>
        </div>
        <div className="right">
          <button className={`chip ${type === "daily" ? "on" : ""}`} onClick={() => setType("daily")}>日复盘</button>
          <button className={`chip ${type === "weekly" ? "on" : ""}`} onClick={() => setType("weekly")}>周复盘</button>
        </div>
      </div>

      <div className="review-grid">
        <section className="card review-card">
          <h2>{type === "daily" ? "今日复盘" : "本周复盘"}</h2>
          <p className="sub">{type === "daily" ? "不用写长，写具体就好。" : "自动汇总已填进第一问，按真实情况改。"}{aiReady ? "" : "（配置 AI Key 后可一键起稿）"}</p>

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
                  <p>{r.summary || r.did || "（空白）"}</p>
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
            <div><span>本周完成</span><b>{doneThisWeek}</b></div>
            <div><span>本周记录</span><b>{notesThisWeek}</b></div>
          </div>
        </section>
      </div>
    </>
  );
}

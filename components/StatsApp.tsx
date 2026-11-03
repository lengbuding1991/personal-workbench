"use client";

import Link from "next/link";
import { ChartNoAxesColumn, CheckCircle2, Download, ListTodo, NotebookPen, CalendarCheck } from "lucide-react";
import TopBar from "./TopBar";

const areaLabel: Record<string, string> = { work: "工作", side: "副业", media: "自媒体", study: "学习", life: "生活" };
const areaColor: Record<string, string> = { work: "#5AA7E8", side: "#A78BFA", media: "#F5AE8E", study: "#6FD6BE", life: "#F6C453" };

export default function StatsApp({
  total,
  done,
  notes,
  reviews,
  activeDays,
  series,
  areaStats,
  recentDone,
  tagStats,
}: {
  total: number;
  done: number;
  notes: number;
  reviews: number;
  activeDays: number;
  series: { label: string; date: string; n: number }[];
  areaStats: { area: string; total: number; done: number }[];
  recentDone: { id: number; title: string; area: string; done_at: string | null }[];
  tagStats: { tag: string; n: number }[];
}) {
  const max = Math.max(1, ...series.map((s) => s.n));
  const rate = total ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <TopBar crumb="数据洞察">
        <Link href="/api/export" className="ghost" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Download size={12} /> 导出 JSON
        </Link>
      </TopBar>
      <div className="page-head">
        <div>
          <div className="eyebrow">DATA · 数据洞察</div>
          <h1>看清楚，再往前走。</h1>
          <p>只统计本地数据，不上传云端。</p>
        </div>
      </div>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ico" style={{ background: "#E8F2FC", color: "#2F7FC4" }}><ListTodo size={15} /></span>全部任务</div>
          <b>{total}<small>件</small></b>
          <div className="d mute">其中 {done} 件已完成</div>
          <div className="track"><i style={{ width: `${rate}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ico" style={{ background: "#E3F8F2", color: "#2E8C77" }}><CheckCircle2 size={15} /></span>完成率</div>
          <b>{rate}%</b>
          <div className="d mute">全部任务口径</div>
          <div className="track"><i style={{ width: `${rate}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ico" style={{ background: "#FCEAF2", color: "#C25E8C" }}><NotebookPen size={15} /></span>记录</div>
          <b>{notes}<small>条</small></b>
          <div className="d mute">{reviews} 篇复盘</div>
          <div className="track"><i style={{ width: `${Math.min(100, notes * 4)}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ico" style={{ background: "#FDF4DC", color: "#A97C1B" }}><CalendarCheck size={15} /></span>活跃日</div>
          <b>{activeDays}<small>天</small></b>
          <div className="d mute">有完成任务的天</div>
          <div className="track"><i style={{ width: `${Math.min(100, activeDays * 8)}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ico" style={{ background: "#F1ECFE", color: "#7C5CE0" }}><ChartNoAxesColumn size={15} /></span>近 7 天完成</div>
          <b>{series.reduce((n, s) => n + s.n, 0)}<small>件</small></b>
          <div className="d mute">日均 {(series.reduce((n, s) => n + s.n, 0) / 7).toFixed(1)} 件</div>
          <div className="track"><i style={{ width: `${Math.min(100, (series.reduce((n, s) => n + s.n, 0) / 14) * 100)}%` }} /></div>
        </div>
      </section>

      <div className="home-grid">
        <section className="card span2">
          <div className="c-head"><h2>最近 7 天完成的任务</h2><span className="sub">按完成日统计</span></div>
          <div className="c-body">
            <div className="big-bars">
              {series.map((s) => (
                <div className={`b ${s.n === max && s.n > 0 ? "hi" : ""}`} key={s.date}>
                  <em>{s.n || ""}</em>
                  <i style={{ height: `${Math.max(4, (s.n / max) * 100)}%`, opacity: s.n ? 1 : 0.35 }} />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="c-head"><h2>各条线的推进</h2></div>
          <div className="c-body">
            {areaStats.map((a) => {
              const pct = a.total ? Math.round((a.done / a.total) * 100) : 0;
              return (
                <div key={a.area} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #F2F7FB" }}>
                  <span style={{ width: 48, fontSize: 11, color: "#5E7183" }}>{areaLabel[a.area]}</span>
                  <div style={{ flex: 1, height: 7, borderRadius: 99, background: "#EEF5FA", overflow: "hidden" }}>
                    <i style={{ display: "block", height: "100%", width: `${pct}%`, background: areaColor[a.area], borderRadius: 99 }} />
                  </div>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#8FA2B3", width: 62, textAlign: "right" }}>{a.done}/{a.total} · {pct}%</span>
                </div>
              );
            })}
            {!areaStats.length && <div className="center-empty" style={{ padding: "22px 0" }}><p>还没有数据。</p></div>}
          </div>
        </section>

        <section className="card span2">
          <div className="c-head"><h2>最近完成的</h2><span className="sub">按完成时间倒序</span><Link href="/tasks" className="more">任务面板 →</Link></div>
          <div className="c-body">
            {recentDone.length ? (
              <div className="done-list">
                {recentDone.map((t) => (
                  <div className="done-row" key={t.id}>
                    <span className="dr-dot" style={{ background: areaColor[t.area] ?? "#9BABBB" }} />
                    <span className="dr-t">{t.title}</span>
                    <span className="dr-a">{areaLabel[t.area]}</span>
                    <span className="dr-d">{t.done_at ? t.done_at.slice(5, 10).replace("-", "/") : ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="center-empty" style={{ padding: "18px 0" }}><p>还没有完成的任务。</p></div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="c-head"><h2>常用标签</h2><span className="sub">按记录数</span></div>
          <div className="c-body">
            {tagStats.length ? (
              <div className="tag-cloud">
                {tagStats.map((t) => (
                  <span className="tag-pill" key={t.tag}>{t.tag}<i>{t.n}</i></span>
                ))}
              </div>
            ) : (
              <div className="center-empty" style={{ padding: "18px 0" }}><p>给记录打标签后，这里会显示你的常用主题。</p></div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

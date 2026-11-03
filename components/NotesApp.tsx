"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, isSameDay, isSameMonth } from "date-fns";
import { Plus, Trash2, Pin, Archive, Eye, Pencil, PenLine } from "lucide-react";
import { marked } from "marked";
import type { Note } from "@/lib/db";
import TopBar from "./TopBar";
import { useConfirm } from "./Confirm";
import { useToast } from "./Toast";

const sources = ["灵感", "工作", "学习", "复盘"];

export default function NotesApp({ initial }: { initial: Note[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(initial.find((n) => !n.archived)?.id ?? null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("灵感");
  const [tagText, setTagText] = useState("");
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const active = useMemo(() => initial.find((n) => n.id === activeId) ?? null, [initial, activeId]);

  useEffect(() => {
    const id = params.get("id");
    if (id) setActiveId(Number(id));
  }, [params]);

  useEffect(() => {
    if (active) {
      setTitle(active.title);
      setContent(active.content);
      setSource(active.source || "灵感");
      setTagText(active.tags || "");
      setSaved("");
      setPreview(false);
    }
  }, [activeId, active]);

  const filtered = initial.filter(
    (n) => Boolean(n.archived) === showArchived && (!q || n.title.includes(q) || n.content.includes(q) || (n.tags || "").includes(q))
  );

  const monthCount = useMemo(
    () => initial.filter((n) => !n.archived && isSameMonth(new Date(n.created_at), new Date())).length,
    [initial]
  );
  const allTags = useMemo(() => {
    const set = new Set<string>();
    initial.forEach((n) => (n.tags || "").split(/[,，\s]+/).forEach((t) => { const v = t.trim(); if (v) set.add(v); }));
    return Array.from(set).slice(0, 6);
  }, [initial]);

  const weekSeries = useMemo(() => {
    const days: { label: string; n: number; today: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const n = initial.filter((x) => !x.archived && isSameDay(new Date(x.created_at), d)).length;
      days.push({ label: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()], n, today: i === 0 });
    }
    return days;
  }, [initial]);
  const weekMax = Math.max(1, ...weekSeries.map((d) => d.n));
  const weekCount = weekSeries.reduce((a, b) => a + b.n, 0);

  const save = async (immediate = false) => {
    if (!active) return;
    if (timer.current) clearTimeout(timer.current);
    const run = async () => {
      await fetch(`/api/notes/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, source, tags: tagText }),
      });
      setSaved(format(new Date(), "HH:mm"));
    };
    if (immediate) await run();
    else timer.current = setTimeout(run, 700);
  };

  const create = async (seed?: string) => {
    setShowArchived(false);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: seed ?? "", content: "", source: "灵感" }),
    });
    const data = await res.json();
    if (data.note) {
      setActiveId(data.note.id);
      router.refresh();
    }
  };

  const remove = async () => {
    if (!active) return;
    const ok = await confirm({
      title: "删除这条记录？",
      desc: `「${active.title || active.content.slice(0, 18) || "无标题"}」删除后无法恢复，建议先导出备份。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    const snap = { title: active.title, content: active.content, source: active.source, tags: active.tags };
    await fetch(`/api/notes/${active.id}`, { method: "DELETE" });
    setActiveId(null);
    router.refresh();
    toast(`已删除「${snap.title || "无标题记录"}」`, {
      label: "撤销",
      onClick: async () => {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snap),
        });
        const data = await res.json();
        if (data.note) setActiveId(data.note.id);
        router.refresh();
      },
    });
  };

  const togglePin = async () => {
    if (!active) return;
    await fetch(`/api/notes/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: active.pinned ? 0 : 1 }),
    });
    router.refresh();
  };

  const toggleArchive = async () => {
    if (!active) return;
    await fetch(`/api/notes/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: active.archived ? 0 : 1 }),
    });
    setActiveId(null);
    router.refresh();
  };

  const html = useMemo(() => marked.parse(content || "", { async: false }) as string, [content]);


  return (
    <>
      <TopBar crumb="记录">
        <button className="primary" onClick={() => create()}><Plus size={12} style={{ verticalAlign: -2, marginRight: 3 }} />新记录</button>
      </TopBar>
      <div className="page-head">
        <div>
          <div className="eyebrow">NOTES · 记录灵感</div>
          <h1>先记下来，再慢慢整理。</h1>
          <p>{initial.filter((n) => !n.archived).length} 条记录 · 自动保存</p>
        </div>
        <div className="right">
          <button className={`chip ${!showArchived ? "on" : ""}`} onClick={() => setShowArchived(false)}>记录</button>
          <button className={`chip ${showArchived ? "on" : ""}`} onClick={() => setShowArchived(true)}>归档</button>
        </div>
      </div>

      <div className="notes-grid">
        <aside className="card notes-side">
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索记录、标签…" />
          <div className="notes-list scroll-thin">
            {filtered.map((n) => (
              <button key={n.id} className={`note-row ${n.id === activeId ? "on" : ""}`} onClick={() => setActiveId(n.id)}>
                <b>{n.title || "(无标题)"}</b>
                {n.content ? <em>{(n.content || "").replace(/[#*`>\-]/g, "").replace(/\s+/g, " ").trim().slice(0, 44)}</em> : null}
                <span>{n.source} · {format(new Date(n.updated_at), "MM/dd HH:mm")}{n.tags ? ` · ${n.tags}` : ""}</span>
              </button>
            ))}
            {!filtered.length && (
              <div className="center-empty" style={{ padding: "30px 10px" }}>
                <b>{showArchived ? "归档里还是空的" : "还没有记录"}</b>
                <p>{showArchived ? "暂时用不上的记录可以归档。" : "想到什么，先扔进来。"}</p>
              </div>
            )}

          <div className="notes-filler">
            <div className="nf-hint">
              <PenLine size={14} />
              <b>随手记一句</b>
              <p>想到什么先扔进来，以后再整理。</p>
              <div className="nf-seeds">
                {["今天的收获", "一个想法", "待办清单", "复盘素材"].map((seed) => (
                  <button key={seed} className="chip" onClick={() => create(seed)}>{seed}</button>
                ))}
              </div>
              <button className="b2" onClick={() => create()}>+ 空白记录</button>
            </div>
          </div>
          </div>
          <div className="notes-foot">
            <div className="nf-row">
              <span>本月记录</span>
              <b>{monthCount}</b>
              <span style={{ marginLeft: "auto" }}>{allTags.length} 个标签</span>
            </div>
            <div className="nf-bar"><i style={{ width: `${Math.min(100, monthCount * 8)}%` }} /></div>
            <div className="nf-row" style={{ marginTop: 2 }}>
              <span>本周</span>
              <b>{weekCount}</b>
              <span style={{ marginLeft: "auto" }}>每天记一笔</span>
            </div>
            <div className="nf-spark" title="最近 7 天的记录数">
              {weekSeries.map((d, i) => (
                <i key={i} className={`${d.n > 0 ? "on" : ""} ${d.today ? "today" : ""}`}
                   style={{ height: `${Math.max(3, (d.n / weekMax) * 100)}%` }} />
              ))}
            </div>
            <div className="nf-label">
              <span>{weekSeries[0].label}</span><span>今天</span>
            </div>
            {allTags.length > 0 && (
              <div className="nf-tags">
                {allTags.slice(0, 4).map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="card note-editor">
          {active ? (
            <>
              <input
                className="title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); save(); }}
                placeholder="给这条记录起个标题"
              />
              <div className="sub">
                <span>{active.source}</span>
                <span>{format(new Date(active.updated_at), "yyyy/MM/dd HH:mm")}</span>
                {saved && <span style={{ color: "#2E8C77" }}>已保存 {saved}</span>}
              </div>
              <div className="tags" style={{ marginBottom: 8 }}>
                {sources.map((s) => (
                  <button key={s} className={`tg ${source === s ? "on" : ""}`} onClick={() => { setSource(s); save(true); }}>{s}</button>
                ))}
                <input
                  value={tagText}
                  onChange={(e) => { setTagText(e.target.value); save(); }}
                  placeholder="标签，逗号分隔"
                  style={{ flex: 1, minWidth: 100, border: 0, background: "transparent", fontSize: 9, outline: "none", color: "#9A8F82" }}
                />
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <button className={`chip ${!preview ? "on" : ""}`} onClick={() => setPreview(false)}><Pencil size={9} style={{ verticalAlign: -1, marginRight: 2 }} />编辑</button>
                <button className={`chip ${preview ? "on" : ""}`} onClick={() => setPreview(true)}><Eye size={9} style={{ verticalAlign: -1, marginRight: 2 }} />预览</button>
                <span className="hint2" style={{ marginLeft: "auto", alignSelf: "center" }}>支持 Markdown</span>
              </div>

              {preview ? (
                <div className="md scroll-thin" dangerouslySetInnerHTML={{ __html: html || "<p style='color:#B0A598'>还没有内容。</p>" }} />
              ) : (
                <textarea
                  ref={taRef}
                  value={content}
                  onChange={(e) => { setContent(e.target.value); save(); }}
                  placeholder="想到什么就写什么，不用整理…支持 Markdown"
                />
              )}

              <div className="foot">
                <button className="b-small" onClick={togglePin}><Pin size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{active.pinned ? "取消置顶" : "置顶"}</button>
                <button className="b-small" onClick={toggleArchive}><Archive size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{active.archived ? "移出归档" : "归档"}</button>
                <button className="b-small danger" onClick={remove}><Trash2 size={10} style={{ verticalAlign: -1, marginRight: 3 }} />删除</button>
                <span className="hint2" style={{ marginLeft: "auto" }}>停止输入 0.7 秒后自动保存</span>
                <button className="b1" onClick={() => save(true)}>立即保存</button>
              </div>
            </>
          ) : (
            <div className="center-empty">
              <b>选一条记录，或新建一条</b>
              <p>记录会存在本地数据库，随时可以导出。</p>
              <button className="b1" onClick={() => create()}>新记录</button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

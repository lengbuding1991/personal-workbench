"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, isSameDay, isSameMonth } from "date-fns";
import { Plus, Trash2, Pin, Archive, Eye, Pencil, PenLine, ChevronLeft } from "lucide-react";
import { marked } from "marked";
import type { Note } from "@/lib/db";
import TopBar from "./TopBar";
import { useConfirm } from "./Confirm";
import { useToast } from "./Toast";
import { api, errText } from "@/lib/api";

const sources = ["灵感", "工作", "学习", "复盘"];

export default function NotesApp({ initial }: { initial: Note[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [notes, setNotes] = useState<Note[]>(() => initial.map((n) => ({ ...n })));
  const [activeId, setActiveId] = useState<number | null>(initial.find((n) => !n.archived)?.id ?? null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("灵感");
  const [tagText, setTagText] = useState("");
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState<string>("");
  // 手机上列表和编辑是两块屏：false=看列表，true=写这条。
  // 桌面上两块并排显示，这个值不起作用（只在 CSS 的窄屏断点里生效）。
  const [mEditing, setMEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  // 保存时读这里的最新值，避免闭包捕获旧 state（stale closure）
  const draft = useRef({ title: "", content: "", source: "灵感", tags: "" });

  const active = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  useEffect(() => {
    const id = params.get("id");
    if (id) setActiveId(Number(id));
  }, [params]);

  // 服务端快照变化时同步到本地，保证列表与数据库一致
  useEffect(() => {
    setNotes(initial);
  }, [initial]);

  useEffect(() => {
    const n = notes.find((x) => x.id === activeId);
    if (n) {
      setTitle(n.title);
      setContent(n.content);
      setSource(n.source || "灵感");
      setTagText(n.tags || "");
      draft.current = { title: n.title, content: n.content, source: n.source || "灵感", tags: n.tags || "" };
      setSaved("");
      setPreview(false);
    }
    // 只在切换记录时重置，不随 notes 内容变化重跑，避免清掉「已保存」提示
  }, [activeId]);

  const filtered = notes
    .filter(
      (n) => Boolean(n.archived) === showArchived && (!q || n.title.includes(q) || n.content.includes(q) || (n.tags || "").includes(q))
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updated_at).localeCompare(String(a.updated_at)));

  const monthCount = useMemo(
    () => notes.filter((n) => !n.archived && isSameMonth(new Date(n.created_at), new Date())).length,
    [notes]
  );
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => (n.tags || "").split(/[,，\s]+/).forEach((t) => { const v = t.trim(); if (v) set.add(v); }));
    return Array.from(set).slice(0, 6);
  }, [notes]);

  const weekSeries = useMemo(() => {
    const days: { label: string; n: number; today: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const n = notes.filter((x) => !x.archived && isSameDay(new Date(x.created_at), d)).length;
      days.push({ label: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()], n, today: i === 0 });
    }
    return days;
  }, [notes]);
  const weekMax = Math.max(1, ...weekSeries.map((d) => d.n));
  const weekCount = weekSeries.reduce((a, b) => a + b.n, 0);

  const save = async (immediate = false) => {
    if (!active) return;
    if (timer.current) clearTimeout(timer.current);
    const run = async () => {
      // 从 draft.current 读最新值，而不是闭包里的 state（避免 stale closure）
      const { title: t, content: c, source: s, tags: g } = draft.current;
      try {
        await api(`/api/notes/${active.id}`, {
          method: "PATCH",
          body: { title: t, content: c, source: s, tags: g },
        });
        setSaved(format(new Date(), "HH:mm:ss"));
        // 通知 Next 丢掉这一页的客户端缓存快照，否则 30 秒内切回来还是旧数据
        router.refresh();
        // 实时更新本地列表，让左侧标题/摘要立即刷新
        setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, title: t, content: c, source: s, tags: g, updated_at: nowIsoLocal() } : n)));
        return true;
      } catch (e) {
        // 以前自动保存失败是静默的：用户以为存上了，其实没有
        setSaved("");
        toast(errText(e, "保存失败，检查网络后重试"));
        return false;
      }
    };
    if (immediate) {
      setSaving(true);
      const ok = await run();
      setSaving(false);
      if (ok) toast("已保存");
    } else {
      timer.current = setTimeout(run, 700);
    }
  };

  function nowIsoLocal() {
    return format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  /**
   * 还没开始写的记录：正文一个字都没有。
   *
   * 注意不能要求「标题也空」——起步词（今天的收获/一个想法…）会把标题
   * 填上，那样第二次点击时这条就不算空了，又会新建一条空壳。
   */
  const isBlank = (n: Note) => !n.content.trim();

  const create = async (seed?: string) => {
    setShowArchived(false);
    // 已经有一条空的就不必再建一条：以前点两次「今天的收获」会在库里
    // 留下两条空记录，统计里的「本周记录」也跟着涨。
    const blank = notes.find(isBlank);
    if (blank) {
      if (seed) {
        setNotes((prev) => prev.map((n) => (n.id === blank.id ? { ...n, title: seed } : n)));
        void api(`/api/notes/${blank.id}`, { method: "PATCH", body: { title: seed } }).catch(() => {});
      }
      setActiveId(blank.id);
      setMEditing(true);
      router.refresh();
      return;
    }
    try {
      const data = await api<{ note: Note }>("/api/notes", {
        method: "POST",
        body: { title: seed ?? "", content: "", source: "灵感" },
      });
      if (data.note) {
        const note = { ...data.note } as Note;
        setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
        setActiveId(note.id);
        setMEditing(true);
        router.refresh();
      }
    } catch (e) {
      toast(errText(e, "新建记录失败"));
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
    try {
      await api(`/api/notes/${active.id}`, { method: "DELETE" });
    } catch (e) {
      toast(errText(e, "删除失败，记录还在"));
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== active.id));
    setActiveId(null);
    router.refresh();
    toast(`已删除「${snap.title || "无标题记录"}」`, {
      label: "撤销",
      onClick: async () => {
        try {
          const data = await api<{ note: Note }>("/api/notes", { method: "POST", body: snap });
          if (data.note) {
            const note = { ...data.note } as Note;
            setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
            setActiveId(note.id);
            router.refresh();
          }
        } catch (e) {
          toast(errText(e, "撤销失败"));
        }
      },
    });
  };

  const togglePin = async () => {
    if (!active) return;
    const next = active.pinned ? 0 : 1;
    try {
      await api(`/api/notes/${active.id}`, { method: "PATCH", body: { pinned: next } });
    } catch (e) {
      toast(errText(e, "操作失败，请重试"));
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, pinned: next as 0 | 1, updated_at: nowIsoLocal() } : n)));
    router.refresh();
    toast(next ? "已置顶，排在最上面" : "已取消置顶");
  };

  const toggleArchive = async () => {
    if (!active) return;
    const next = active.archived ? 0 : 1;
    try {
      await api(`/api/notes/${active.id}`, { method: "PATCH", body: { archived: next } });
    } catch (e) {
      toast(errText(e, next ? "归档失败" : "取消归档失败"));
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, archived: next as 0 | 1 } : n)));
    setActiveId(null);
    router.refresh();
    toast(next ? "已归档" : "已取消归档");
  };

  const html = useMemo(() => marked.parse(content || "", { async: false, breaks: true }) as string, [content]);


  return (
    <>
      <TopBar crumb="记录">
        <button className="primary" onClick={() => create()}><Plus size={12} style={{ verticalAlign: -2, marginRight: 3 }} />新记录</button>
      </TopBar>
      <div className={`page-head ${mEditing ? "m-hide" : ""}`}>
        <div>
          <div className="eyebrow">NOTES · 记录灵感</div>
          <h1>先记下来，再慢慢整理。</h1>
          <p>{notes.filter((n) => !n.archived).length} 条记录 · 自动保存</p>
        </div>
        <div className="right">
          <button className={`chip ${!showArchived ? "on" : ""}`} onClick={() => setShowArchived(false)}>记录</button>
          <button className={`chip ${showArchived ? "on" : ""}`} onClick={() => setShowArchived(true)}>归档</button>
        </div>
      </div>

      <div className={`notes-grid ${mEditing ? "m-edit" : "m-list"}`}>
        <aside className="card notes-side">
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索记录、标签…" />
          <div className="notes-list scroll-thin">
            {filtered.map((n) => (
              <button key={n.id} className={`note-row ${n.id === activeId ? "on" : ""}`} onClick={() => { setActiveId(n.id); setMEditing(true); }}>
                <b>{n.pinned ? <Pin size={10} className="nr-pin" /> : null}{n.title || "(无标题)"}</b>
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
          <button className="note-back" onClick={() => setMEditing(false)}>
            <ChevronLeft size={15} /> 全部记录
          </button>
          {active ? (
            <>
              <input
                className="title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); draft.current.title = e.target.value; save(); }}
                placeholder="给这条记录起个标题"
              />
              <div className="sub">
                <span>{active.source}</span>
                <span>{format(new Date(active.updated_at), "yyyy/MM/dd HH:mm")}</span>
                {saved && <span style={{ color: "#2E8C77" }}>已保存 {saved}</span>}
              </div>
              <div className="tags" style={{ marginBottom: 8 }}>
                {sources.map((s) => (
                  <button key={s} className={`tg ${source === s ? "on" : ""}`} onClick={() => { setSource(s); draft.current.source = s; save(true); }}>{s}</button>
                ))}
                <input
                  value={tagText}
                  onChange={(e) => { setTagText(e.target.value); draft.current.tags = e.target.value; save(); }}
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
                  onChange={(e) => { setContent(e.target.value); draft.current.content = e.target.value; save(); }}
                  placeholder="想到什么就写什么，不用整理…支持 Markdown"
                />
              )}

              <div className="foot">
                <button className="b-small" onClick={togglePin}><Pin size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{active.pinned ? "取消置顶" : "置顶"}</button>
                <button className="b-small" onClick={toggleArchive}><Archive size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{active.archived ? "移出归档" : "归档"}</button>
                <button className="b-small danger" onClick={remove}><Trash2 size={10} style={{ verticalAlign: -1, marginRight: 3 }} />删除</button>
                <span className="hint2" style={{ marginLeft: "auto" }}>停止输入 0.7 秒后自动保存</span>
                <button className="b1" onClick={() => save(true)} disabled={saving}>{saving ? "保存中…" : "立即保存"}</button>
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

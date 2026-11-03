"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uiLock } from "@/lib/ui-lock";

type Hit = { id: number; title: string; kind: "task" | "note" };
type Row =
  | { type: "go"; href: string; label: string; hint?: string }
  | { type: "capture"; label: string; hint?: string }
  | { type: "search"; q: string; label: string }
  | { type: "hit"; hit: Hit };

const quick: { href: string; label: string }[] = [
  { href: "/", label: "今日行动" },
  { href: "/tasks", label: "任务面板" },
  { href: "/notes", label: "记录灵感" },
  { href: "/calendar", label: "日历安排" },
  { href: "/review", label: "每日复盘" },
  { href: "/ai", label: "AI 助手" },
  { href: "/stats", label: "数据洞察" },
  { href: "/settings", label: "偏好设置" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (uiLock.modal > 0 && e.key !== "Escape") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setHits([...(data.tasks || []), ...(data.notes || [])].slice(0, 8));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setActive(0), [q]);

  const keyword = q.trim();
  const rows: Row[] = useMemo(() => {
    if (!keyword) {
      return [
        ...quick
          .filter((x) => !keyword || x.label.includes(keyword))
          .map((x) => ({ type: "go" as const, href: x.href, label: x.label })),
        { type: "capture" as const, label: "快速记一笔", hint: "C" },
      ];
    }
    return [
      ...hits.map((h) => ({ type: "hit" as const, hit: h })),
      { type: "search" as const, q: keyword, label: `查看“${keyword}”的全部结果` },
      { type: "capture" as const, label: `把“${keyword}”记成一条记录` },
    ];
  }, [keyword, hits]);

  const run = (r: Row) => {
    setOpen(false);
    if (r.type === "go") router.push(r.href);
    else if (r.type === "hit") router.push(r.hit.kind === "task" ? `/tasks?focus=${r.hit.id}` : `/notes?id=${r.hit.id}`);
    else if (r.type === "search") router.push(`/search?q=${encodeURIComponent(r.q)}`);
    else if (r.type === "capture") {
      if (keyword) window.dispatchEvent(new CustomEvent("open-capture", { detail: { text: keyword } }));
      else window.dispatchEvent(new Event("open-capture"));
    }
  };

  if (!open) return null;

  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)}>
      <div className="cmd" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索任务、记录，或输入关键词…"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const r = rows[active];
              if (r) run(r);
            }
          }}
        />
        <div className="cmd-body scroll-thin">
          {!keyword && rows.some((r) => r.type === "go") && <div className="cmd-group">跳转到</div>}
          {keyword && loading && <div className="cmd-empty">搜索中…</div>}
          {keyword && !loading && hits.length === 0 && <div className="cmd-empty">没有找到「{keyword}」</div>}
          {keyword && hits.length > 0 && <div className="cmd-group">结果</div>}
          {rows.map((r, i) => {
            if (r.type === "capture" && i > 0 && rows[i - 1].type !== "capture" && keyword) {
              /* 无分组标题，直接排 */
            }
            const label = r.type === "hit" ? r.hit.title || "(无标题)" : r.label;
            const badge =
              r.type === "hit" ? (r.hit.kind === "task" ? "任务" : "记录") : r.type === "go" ? "页面" : r.type === "search" ? "全部" : "快记";
            return (
              <button
                key={`${r.type}-${i}`}
                className={`cmd-hit ${i === active ? "on" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(r)}
              >
                <span className="cmd-badge">{badge}</span>
                {label}
                {i === active && <span className="k">↵</span>}
              </button>
            );
          })}
        </div>
        <div className="cmd-foot">
          <span><b>↑</b><b>↓</b> 选择</span>
          <span><b>↵</b> 打开</span>
          <span><b>esc</b> 关闭</span>
        </div>
      </div>
    </div>
  );
}

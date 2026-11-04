"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { format, parseISO } from "date-fns";

type Item = { kind: "task" | "event"; id: number; title: string; at: string; priority: string; overdue?: boolean; remindAt?: string };

export default function ReminderBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<string>("default");
  const [nowStr, setNowStr] = useState("");
  const seen = useRef<Set<string>>(new Set());
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/reminders", { cache: "no-store" });
      const data = await res.json();
      const list: Item[] = data.items || [];
      setItems(list);
      if (data.now) setNowStr(data.now);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const it of list) {
          const key = `${it.kind}-${it.id}`;
          if (seen.current.has(key)) continue;
          seen.current.add(key);
          new Notification(it.kind === "event" ? "日程快到了" : "任务提醒", { body: `${it.title}${it.at ? " · " + (it.at.includes("T") ? format(parseISO(it.at), "HH:mm") : "今天") : ""}` });
        }
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  // 打开后点外面 / 按 Esc 都能收起。以前没有这段，弹层只能再点一次铃铛才关得掉。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ask = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      seen.current.clear();
      load();
    }
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button className="ghost" onClick={() => setOpen((v) => !v)} aria-label="提醒" style={{ position: "relative" }}>
        <Bell size={13} />
        {items.length > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 13, height: 13, borderRadius: 99, background: "linear-gradient(140deg,#4FD3C8,#33A9D6)", color: "#fff", fontSize: 7.5, display: "grid", placeItems: "center", padding: "0 3px" }}>
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="bell-pop">
          <div className="bell-head">
            <b>接下来</b>
            <span>{items.length} 件</span>
          </div>
          {items.length === 0 && <p className="hint2" style={{ padding: "8px 2px" }}>未来 4 小时没有要提醒的事。</p>}
          {items.map((it) => (
            <div className="bell-item" key={`${it.kind}-${it.id}`}>
              <span className={`bell-dot ${it.kind}`} />
              <div style={{ minWidth: 0 }}>
                <b>{it.title}</b>
                <small>{it.kind === "event" ? "日程" : "任务"}{it.at ? ` · ${it.at.includes("T") ? format(parseISO(it.at), "HH:mm") : "今天"}` : ""}{it.overdue ? " · 已到期" : it.remindAt && it.remindAt <= (nowStr || "") ? " · 该做了" : ""}</small>
              </div>
            </div>
          ))}
          {permission !== "granted" && (
            <button className="b-small" style={{ width: "100%", marginTop: 8 }} onClick={ask}>开启浏览器通知</button>
          )}
          {permission === "granted" && <p className="hint2" style={{ marginTop: 8 }}>页面开着时，到点会弹系统通知。</p>}
        </div>
      )}
    </div>
  );
}

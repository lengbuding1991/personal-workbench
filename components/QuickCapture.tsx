"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, X } from "lucide-react";
import { uiLock } from "@/lib/ui-lock";
import { useToast } from "./Toast";

const tags = ["灵感", "工作", "学习", "复盘"];

export default function QuickCapture() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [tag, setTag] = useState("灵感");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (uiLock.modal > 0) return;
      if (!typing && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ text?: string }>).detail;
      if (detail?.text) setText(detail.text);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-capture", onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-capture", onOpen as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    uiLock.modal += 1;
    return () => {
      uiLock.modal = Math.max(0, uiLock.modal - 1);
    };
  }, [open]);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const firstLine = text.trim().split("\n")[0].slice(0, 40);
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: firstLine, content: text, source: tag }),
      });
      setText("");
      setOpen(false);
      toast("已记下，存在「记录」里");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="capture-fab" onClick={() => setOpen(true)} title="快速记录（按 C）">
        <PenLine size={16} />
      </button>
      {open && (
        <div className="qc-overlay" onClick={() => setOpen(false)}>
          <div className="qc" onClick={(e) => e.stopPropagation()}>
            <div className="qc-head">
              <b>快速记一笔</b>
              <span className="hint2">写完按 ⌘↵ 保存</span>
              <button className="qc-x" onClick={() => setOpen(false)}><X size={13} /></button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="想到什么，先扔进来。不用整理，不用分类。"
              autoFocus
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
              }}
            />
            <div className="tags">
              {tags.map((t) => (
                <button key={t} className={`tg ${tag === t ? "on" : ""}`} onClick={() => setTag(t)}>{t}</button>
              ))}
              <button className="b1" style={{ marginLeft: "auto" }} onClick={save} disabled={saving}>{saving ? "保存中…" : "记下"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

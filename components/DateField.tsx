"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Select from "./Select";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { CalendarDays, Clock } from "lucide-react";

type Props = {
  value: string; // "yyyy-MM-dd" 或 "yyyy-MM-ddTHH:mm"
  onChange: (v: string) => void;
  mode?: "date" | "datetime";
  placeholder?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function splitVal(v: string) {
  if (!v) return { date: "", time: "09:00" };
  const [date, time] = v.split("T");
  return { date, time: time || "09:00" };
}

export default function DateField({ value, onChange, mode = "date", placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const { date, time } = splitVal(value);

  const selDate = useMemo(() => (date ? new Date(`${date}T12:00:00`) : undefined), [date]);
  const month = useMemo(() => (date ? new Date(`${date}T12:00:00`) : new Date()), [date]);

  const openPop = () => {
    setMobile(window.innerWidth < 760);
    const r = fieldRef.current?.getBoundingClientRect();
    if (r) {
      const w = 304;
      const h = mode === "datetime" ? 424 : 340;
      let left = r.left;
      if (left + w > window.innerWidth - 12) left = window.innerWidth - 12 - w;
      let top = r.bottom + 8;
      if (top + h > window.innerHeight - 12) {
        const above = r.top - h - 8;
        top = above >= 12 ? above : Math.max(12, window.innerHeight - 12 - h);
      }
      setPos({ top, left: Math.max(12, left) });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (d: Date | undefined) => {
    if (!d) return;
    const ds = format(d, "yyyy-MM-dd");
    if (mode === "datetime") {
      onChange(`${ds}T${time}`);
    } else {
      onChange(ds);
      setOpen(false);
    }
  };

  const setTime = (t: string) => {
    if (!date) return;
    onChange(`${date}T${t}`);
  };

  const sameYear = date ? new Date(`${date}T12:00:00`).getFullYear() === new Date().getFullYear() : true;
  const display = !value
    ? placeholder || (mode === "datetime" ? "选择日期时间" : "选择日期")
    : mode === "datetime"
      ? format(new Date(`${date}T${time}:00`), sameYear ? "M月d日 EEE HH:mm" : "yyyy年M月d日 HH:mm", { locale: zhCN })
      : format(new Date(`${date}T12:00:00`), sameYear ? "M月d日 EEE" : "yyyy年M月d日", { locale: zhCN });

  const body = (
    <>
      <div className="df-dp">
        <DayPicker
          mode="single"
          selected={selDate}
          onSelect={pick}
          defaultMonth={month}
          locale={zhCN}
          weekStartsOn={1}
          fixedWeeks
          showOutsideDays
          required={false}
        />
      </div>
      {mode === "datetime" && (
        <div className="df-time">
          <span className="df-time-label"><Clock size={13} /> 时间</span>
          <div className="df-time-sel">
            <Select
              size="sm"
              ariaLabel="小时"
              value={time.slice(0, 2)}
              onChange={(v) => setTime(`${v}:${time.slice(3)}`)}
              options={HOURS.map((h) => ({ value: h, label: `${h} 时` }))}
            />
          </div>
          <b className="df-colon">:</b>
          <div className="df-time-sel">
            <Select
              size="sm"
              ariaLabel="分钟"
              value={time.slice(3)}
              onChange={(v) => setTime(`${time.slice(0, 2)}:${v}`)}
              options={MINUTES.map((m) => ({ value: m, label: `${m} 分` }))}
            />
          </div>
        </div>
      )}
      <div className="df-foot">
        <button type="button" className="today-btn" onClick={() => pick(new Date())}>今天</button>
        {mode === "datetime" && (
          <>
            <button type="button" className="cancel-btn" onClick={() => setOpen(false)}>取消</button>
            <button type="button" className="ok" onClick={() => setOpen(false)}>确定</button>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        ref={fieldRef}
        className={`df-field ${value ? "has" : ""}`}
        onClick={openPop}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {mode === "datetime" ? <Clock size={13} /> : <CalendarDays size={13} />}
        <span>{display}</span>
        {value && (
          <i
            className="df-clear"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            aria-label="清除"
          >
            ×
          </i>
        )}
      </button>

      {open && createPortal(
        mobile ? (
          <div className="df-backdrop" onClick={() => setOpen(false)}>
            <div className="df-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="df-sheet-bar">
                <button type="button" className="cancel" onClick={() => setOpen(false)}>取消</button>
                <b>{mode === "datetime" ? "选择日期时间" : "选择日期"}</b>
                {mode === "datetime" ? (
                  <button type="button" className="ok" onClick={() => setOpen(false)}>确定</button>
                ) : (
                  <span className="ok-placeholder" />
                )}
              </div>
              <div className="df-sheet-body">{body}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="df-backdrop" onClick={() => setOpen(false)} />
            <div className="df-pop" style={{ top: pos?.top, left: pos?.left }}>{body}</div>
          </>
        ),
        document.body
      )}
    </>
  );
}

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/* iOS 那种滚轮：上下滑动，中间一条高亮带，选中的数字落在带子里。
   为什么不用下拉：24 个小时 + 12 个分钟点两次下拉太啰嗦，
   滚轮一次就能拨到，而且手指滑动比点选快。 */
const ITEM_H = 36;

function Wheel({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settled = useRef(false);

  /* 打开时直接滚到当前值，不要从 00 开始 */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, items.indexOf(value));
    el.scrollTop = i * ITEM_H;
    const t = setTimeout(() => { settled.current = true; }, 60);
    return () => clearTimeout(t);
    // 只在挂载时定位一次，之后由用户滚动驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el || !settled.current) return;
    const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
    const v = items[i];
    if (v && v !== value) onChange(v);
  };

  const jump = (it: string) => {
    const el = ref.current;
    const i = items.indexOf(it);
    if (el) el.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
    onChange(it);
  };

  return (
    <div className="wh">
      <div className="wh-scroll" ref={ref} onScroll={onScroll}>
        <div className="wh-pad" />
        {items.map((it) => (
          <button
            key={it}
            type="button"
            className={`wh-item ${it === value ? "on" : ""}`}
            onClick={() => jump(it)}
            tabIndex={-1}
          >
            {it}
          </button>
        ))}
        <div className="wh-pad" />
      </div>
    </div>
  );
}

export default function DateField({ value, onChange, mode = "date", placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
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
      // 手机走底部抽屉不用算位置；桌面是下拉版，比滚轮矮一截
      const h = mode === "datetime" ? 430 : 340;
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

  /* 内容高度是估算的（日期+滚轮），估算偏小就会探出视口底部。
     渲染完拿真实高度量一次，超了就整体上移，保证整块都在屏幕里。 */
  useLayoutEffect(() => {
    if (!open || mobile) return;
    const el = popRef.current;
    if (!el) return;
    const over = el.getBoundingClientRect().bottom - (window.innerHeight - 12);
    if (over > 0) setPos((p) => (p ? { ...p, top: Math.max(12, p.top - over) } : p));
  }, [open, mobile]);

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
        mobile ? (
          /* 手机上滚轮好拨：一根手指滑到想要的时间，比点两次下拉快 */
          <div className="df-time">
            <div className="df-wheel-head">
              <span>时</span>
              <span>分</span>
            </div>
            <div className="df-wheels">
              {/* 一条带子横跨两列，跟 iOS 一样；分成两条会有接缝 */}
              <div className="df-band" aria-hidden />
              <Wheel
                items={HOURS}
                value={time.slice(0, 2)}
                onChange={(v) => setTime(`${v}:${time.slice(3)}`)}
              />
              <Wheel
                items={MINUTES}
                value={time.slice(3)}
                onChange={(v) => setTime(`${time.slice(0, 2)}:${v}`)}
              />
            </div>
          </div>
        ) : (
          /* 桌面上还是两个下拉：鼠标点两下就完事，滚轮反而要点着拖 */
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
        )
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
            <div className="df-pop" ref={popRef} style={{ top: pos?.top, left: pos?.left }}>{body}</div>
          </>
        ),
        document.body
      )}
    </>
  );
}

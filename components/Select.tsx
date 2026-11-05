"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/**
 * 统一的下拉选择。
 *
 * 为什么要自己画：原生 <select> 弹出的那层选项列表是操作系统画的，
 * CSS 完全管不到 —— 在 mac 上是系统菜单，在手机上是一排滚轮，
 * 跟工作台这套清透蓝绿的风格完全不搭。所以把触发按钮和弹层都自己实现。
 *
 * 两个尺寸：
 *   sm —— 跟小按钮同高（24px），用在卡片标题右侧那种紧凑位置
 *   md —— 表单字段高度，用在弹窗里
 */

export type Option = { value: string; label: string };

export default function Select({
  value,
  onChange,
  options,
  size = "md",
  placeholder = "请选择",
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  size?: "sm" | "md";
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, up: false });

  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);

  /* 打开时定位弹层：优先向下，下方空间不够就翻到上面 */
  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const isMobile = window.innerWidth < 760;
    setMobile(isMobile);
    if (isMobile) return;

    const H = Math.min(options.length * 34 + 12, 300);
    const below = window.innerHeight - r.bottom;
    const up = below < H + 12 && r.top > below;
    setPos({
      left: Math.min(r.left, window.innerWidth - 200),
      top: up ? r.top - H - 6 : r.bottom + 6,
      width: Math.max(r.width, 140),
      up,
    });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  /* 打开时把当前项滚进视野、定位高亮到当前项 */
  useEffect(() => {
    if (!open) return;
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
  }, [open, value, options]);

  /* 点击外部 / Esc / 滚动 / 改窗口大小都关掉 */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const o = options[active];
        if (o) {
          e.preventDefault();
          pick(o.value);
        }
      }
    };
    const onScroll = () => setOpen(false);
    const onResize = () => setOpen(false);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, active, options]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const list = (
    <div
      ref={boxRef}
      className={`sel-list ${mobile ? "is-sheet" : ""} ${pos.up ? "up" : ""}`}
      style={
        mobile
          ? undefined
          : { position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 130 }
      }
      role="listbox"
      aria-label={ariaLabel}
    >
      {mobile && (
        <div className="sel-sheet-head">
          <b>{ariaLabel || "选择"}</b>
          <button type="button" onClick={() => setOpen(false)}>
            关闭
          </button>
        </div>
      )}
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="option"
          aria-selected={o.value === value}
          className={`sel-opt ${o.value === value ? "on" : ""} ${i === active ? "hot" : ""}`}
          onMouseEnter={() => setActive(i)}
          onClick={() => pick(o.value)}
        >
          <span>{o.label}</span>
          {o.value === value && <Check size={13} />}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`sel-btn sel-${size}${open ? " open" : ""}${className ? " " + className : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="sel-txt">{current?.label ?? placeholder}</span>
        <ChevronDown size={size === "sm" ? 9 : 13} className="sel-chev" />
      </button>
      {open && typeof document !== "undefined"
        ? mobile
          ? createPortal(
              <div className="sel-mask" onClick={() => setOpen(false)}>
                {list}
              </div>,
              document.body
            )
          : createPortal(list, document.body)
        : null}
    </>
  );
}

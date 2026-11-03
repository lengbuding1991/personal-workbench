"use client";

import { useCallback, useRef, useState } from "react";

export type DragGhost = { x: number; y: number; w: number; label: string; tone?: string };

/**
 * 指针拖拽（同时支持鼠标与触屏）。
 * - 鼠标：移动超过 5px 就算开始拖。
 * - 触屏：需要按住 220ms 再移动，否则视为滚动。
 * 不依赖 HTML5 draggable，因此手机上也能用。
 */
export function usePointerDrag<T>(
  onDrop: (drop: { payload: T; x: number; y: number }) => void,
  opts: { touchDelay?: number; threshold?: number } = {}
) {
  const { touchDelay = 220, threshold = 5 } = opts;
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const dragging = useRef(false);
  /** 刚刚完成了一次拖拽 —— 调用方用它来吞掉紧随其后的 click。 */
  const didDrag = useRef(false);

  const begin = useCallback(
    (e: React.PointerEvent, payload: T, label: string, tone?: string) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const sx = e.clientX;
      const sy = e.clientY;
      let armed = e.pointerType !== "touch";
      let started = false;

      const onMove = (ev: PointerEvent) => {
        if (!started) {
          const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
          if (!armed) {
            if (dist > 8) finish(false);
            return;
          }
          if (dist < threshold) return;
          started = true;
          dragging.current = true;
          document.body.classList.add("dragging");
        }
        setGhost({ x: ev.clientX, y: ev.clientY, w: rect.width, label, tone });
      };

      const onUp = (ev: PointerEvent) => {
        const wasDragging = started;
        finish(wasDragging);
        if (wasDragging) onDrop({ payload, x: ev.clientX, y: ev.clientY });
      };

      const timer = setTimeout(() => {
        armed = true;
      }, touchDelay);

      function finish(commit: boolean) {
        window.clearTimeout(timer);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        document.body.classList.remove("dragging");
        dragging.current = false;
        if (commit) didDrag.current = true;
        setGhost(null);
      }

      function onCancel() {
        finish(false);
      }

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [onDrop, threshold, touchDelay]
  );

  return { begin, ghost, dragging, didDrag };
}

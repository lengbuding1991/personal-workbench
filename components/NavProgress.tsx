"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 顶部一条 2px 的青绿进度线。
 *
 * 为什么用这种方式：项目里所有页面都是 force-dynamic，经 CF 隧道回源到 NAS
 * 的 ttfb 大约 1 秒。浏览器在等服务端响应的这一秒里，地址栏不动、页面不动，
 * 用户唯一的感受就是「点了没反应」。
 *
 * 这里不假装知道真实进度（那需要接 router 事件，Next 15 的 App Router 没暴露），
 * 而是拿 pathname 当信号：
 *   · 点击侧栏 → 自定义事件 nav-start → 亮起
 *   · pathname 变了（新页面渲染完）→ 200ms 后熄灭
 *   · 兜底：4 秒还没变就自己熄灭，避免一直亮着
 *
 * 配合 `app/(app)/loading.tsx` 的骨架屏，点击瞬间就有三处反馈：
 * 顶部细线、侧栏高亮、内容区骨架。
 */
export default function NavProgress() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = () => {
      setOn(true);
      if (timer.current) clearTimeout(timer.current);
      // 兜底：万一路由失败或极慢，别让线一直挂着
      timer.current = setTimeout(() => setOn(false), 4000);
    };
    window.addEventListener("wb:nav-start", start);
    return () => {
      window.removeEventListener("wb:nav-start", start);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // pathname 变了 → 新页面已经渲染出来，收尾
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setOn(false), 200);
    return () => clearTimeout(t);
  }, [pathname, on]);

  return <div className={`nav-progress${on ? " on" : ""}`} aria-hidden />;
}

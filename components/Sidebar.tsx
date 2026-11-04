"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  ListTodo,
  FolderKanban,
  CalendarDays,
  NotebookPen,
  RotateCcw,
  Wand2,
  ChartNoAxesColumn,
  Search,
  Settings,
  LogOut,
  MoreHorizontal,
  X,
} from "lucide-react";

/**
 * 导航分两组。
 *
 * 为什么分组：桌面侧栏能放下 10 项，但手机底部一排塞 9 个图标时，
 * 每个只剩 40 出头像素宽、文字挤成 9px，点都点不准。所以手机上
 * 只留 4 个最常用的，其余收进「更多」弹层。
 *
 * 注意：以前 `.nav-foot` 在移动端是 `display:none`，导致手机上
 * 根本没有「设置」入口 —— 这次一并修掉，设置放进「更多」里。
 */
const primary = [
  { href: "/", label: "成长总览", icon: House },
  { href: "/tasks", label: "任务面板", icon: ListTodo },
  { href: "/calendar", label: "日历安排", icon: CalendarDays },
  { href: "/notes", label: "记录灵感", icon: NotebookPen },
];

const secondary = [
  { href: "/projects", label: "项目进度", icon: FolderKanban },
  { href: "/review", label: "每日复盘", icon: RotateCcw },
  { href: "/ai", label: "AI 助手", icon: Wand2 },
  { href: "/stats", label: "数据洞察", icon: ChartNoAxesColumn },
  { href: "/search", label: "全局搜索", icon: Search },
];

/** 点导航时点亮顶部进度线（见 components/NavProgress.tsx） */
function ping() {
  window.dispatchEvent(new Event("wb:nav-start"));
}

export default function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  // 「更多」里任意一项当前被选中时，把「更多」按钮也点亮，否则用户看不出自己在哪
  const inMore = secondary.some((it) => isActive(it.href)) || isActive("/settings");

  // 切页面后自动收起「更多」
  useEffect(() => setMore(false), [pathname]);

  // 打开时锁住 body 滚动，避免背后的页面跟着滑
  useEffect(() => {
    if (!more) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [more]);

  return (
    <>
      <aside className="side">
        <div className="brand">
          <div className="logo">
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="10" height="6" rx="3" fill="#fff" opacity=".95" />
              <rect x="1" y="9" width="6" height="10" rx="3" fill="#fff" opacity=".8" />
              <rect x="9" y="9" width="10" height="10" rx="5" fill="#fff" opacity=".55" />
            </svg>
          </div>
          <div>
            <b>个人成长工作台</b>
            <span>GROWTH WORKBENCH</span>
          </div>
        </div>
        <div className="tagline">安排好行动，<br />让生活慢慢生长。</div>

        <nav className="nav">
          {primary.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={isActive(it.href) ? "active" : ""}
                onClick={ping}
                prefetch
              >
                <Icon />
                <span>{it.label}</span>
              </Link>
            );
          })}
          {secondary.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`nav-2nd ${isActive(it.href) ? "active" : ""}`}
                onClick={ping}
                prefetch
              >
                <Icon />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="nav-foot nav-2nd">
          <nav className="nav">
            <Link href="/settings" className={isActive("/settings") ? "active" : ""} onClick={ping}>
              <Settings />
              <span>设置</span>
            </Link>
          </nav>
        </div>

        <div className="side-foot">
          <div className="ava">{userName.slice(0, 1).toUpperCase()}</div>
          <div className="sf-meta">
            <b>{userName}</b>
            <span>已登录 · 本机</span>
          </div>
          <button
            className="sf-out"
            title="退出登录"
            aria-label="退出登录"
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              window.location.href = "/login";
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* 手机端底部第 5 格：打开「更多」 */}
      <button
        className={`m-more-btn ${inMore ? "active" : ""}`}
        onClick={() => setMore(true)}
        aria-label="更多功能"
      >
        <MoreHorizontal size={17} />
        <span>更多</span>
      </button>

      {/* 手机端「更多」弹层：列出收起来的那几项 + 设置 */}
      {more && (
        <div className="m-more-mask" onClick={() => setMore(false)}>
          <div className="m-more" onClick={(e) => e.stopPropagation()}>
            <div className="m-more-head">
              <b>全部功能</b>
              <button onClick={() => setMore(false)} aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className="m-more-grid">
              {[...secondary, { href: "/settings", label: "设置", icon: Settings }].map((it) => {
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={isActive(it.href) ? "on" : ""}
                    onClick={ping}
                  >
                    <Icon size={20} />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
            <button
              className="m-more-out"
              onClick={async () => {
                await fetch("/api/auth", { method: "DELETE" });
                window.location.href = "/login";
              }}
            >
              <LogOut size={14} /> 退出登录
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  ListTodo,
  CalendarDays,
  NotebookPen,
  RotateCcw,
  Wand2,
  ChartNoAxesColumn,
  Search,
  Settings,
  LogOut,
} from "lucide-react";

const items = [
  { href: "/", label: "成长总览", icon: House },
  { href: "/tasks", label: "任务面板", icon: ListTodo },
  { href: "/calendar", label: "日历安排", icon: CalendarDays },
  { href: "/notes", label: "记录灵感", icon: NotebookPen },
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
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
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
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={isActive(it.href) ? "active" : ""}
              onClick={ping}
            >
              <Icon />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="nav-foot">
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
  );
}

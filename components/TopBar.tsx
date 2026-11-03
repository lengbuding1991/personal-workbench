"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, CalendarDays } from "lucide-react";
import ReminderBell from "./ReminderBell";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function TopBar({
  crumb,
  children,
}: {
  crumb: string;
  children?: React.ReactNode;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="top">
      <div className="crumb">
        <b>个人成长工作台</b> / {crumb}
      </div>
      <div className="top-right">
        <button
          className="searchbar"
          onClick={() => window.dispatchEvent(new Event("open-command"))}
          aria-label="搜索内容、任务或记录"
        >
          <Search size={13} />
          <span>搜索内容、任务或记录…</span>
        </button>
        <ReminderBell />
        <Link href="/calendar" className="ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <CalendarDays size={12} />
          <span className="today">{now ? format(now, "yyyy年M月d日 EEE", { locale: zhCN }) : ""}</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

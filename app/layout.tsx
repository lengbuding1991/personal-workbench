import type { Metadata } from "next";
import "./globals.css";
import { ensureBackup } from "@/lib/db";

export const metadata: Metadata = {
  title: "个人工作台",
  description: "本地优先的个人工作台：任务、日程、记录、复盘与 AI 助手",
};

export const dynamic = "force-dynamic";

/**
 * 根布局只负责 html/body 与全局样式。
 * 侧栏等应用外壳在 `app/(app)/layout.tsx`，因此登录页 `/login` 不会带出侧栏。
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  try {
    ensureBackup();
  } catch {
    // 数据库尚未初始化时不让布局崩溃
  }
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

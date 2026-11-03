import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import QuickCapture from "@/components/QuickCapture";
import { ConfirmProvider } from "@/components/Confirm";
import { ToastProvider } from "@/components/Toast";
import { getSetting, ensureBackup } from "@/lib/db";

export const metadata: Metadata = {
  title: "个人工作台",
  description: "本地优先的个人工作台：任务、日程、记录、复盘与 AI 助手",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let name = "Hina";
  try {
    name = getSetting("user_name", "Hina");
    ensureBackup();
  } catch {
    // 数据库尚未初始化时不让布局崩溃
  }
  return (
    <html lang="zh-CN">
      <body>
        <ToastProvider>
          <ConfirmProvider>
            <div className="blobs" aria-hidden>
              <i className="b1" />
              <i className="b2" />
              <i className="b3" />
            </div>
            <Sidebar userName={name} />
            <main>{children}</main>
            <CommandPalette />
            <QuickCapture />
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

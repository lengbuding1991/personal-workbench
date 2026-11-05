import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ensureBackup } from "@/lib/db";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "个人工作台",
  description: "本地优先的个人工作台：任务、日程、记录、复盘与 AI 助手",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "个人工作台",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

// 关掉 iOS Safari 聚焦输入框时自动放大页面（保持输入框现有字号不变）
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#EFF6FC",
  colorScheme: "light",
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
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

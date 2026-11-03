"use client";

import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import QuickCapture from "@/components/QuickCapture";
import Blobs from "@/components/Blobs";
import { ConfirmProvider } from "@/components/Confirm";
import { ToastProvider } from "@/components/Toast";

/**
 * 应用外壳：侧栏 + 命令面板 + 快速记录。
 * 放在 `app/(app)/layout.tsx` 里，这样登录页 `/login` 不会带出侧栏。
 */
export default function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Blobs />
        <Sidebar userName={userName} />
        <main>{children}</main>
        <CommandPalette />
        <QuickCapture />
      </ConfirmProvider>
    </ToastProvider>
  );
}

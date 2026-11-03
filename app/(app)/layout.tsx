import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getSetting } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware 只挡「没有 cookie / 已过期」，真正的签名校验在这里做
  // （验签要用数据库里的密码哈希，middleware 跑在 edge runtime 读不到库）
  if (!(await isAuthed())) redirect("/login");

  let name = "Hina";
  try {
    name = getSetting("user_name", "Hina");
  } catch {
    // 数据库未初始化时用默认名
  }
  return <AppShell userName={name}>{children}</AppShell>;
}

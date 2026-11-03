import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getSetting } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware 只挡「没有 cookie / 已过期」，真正的签名校验在这里做
  // （验签要用数据库里的密码哈希，middleware 跑在 edge runtime 读不到库）
  if (!(await isAuthed())) {
    // 跳转由这里做而不是 middleware：middleware 的 NextResponse.redirect 必须给
    // 绝对地址，而 nginx 后面的应用只认自己的 127.0.0.1:3200，用户会被带到
    // 「本机 3200 端口」。redirect() 只回相对路径，浏览器按当前域名补全。
    const h = await headers();
    const back = h.get("x-wb-next") || "";
    const qs = back && back !== "/" ? `?next=${encodeURIComponent(back)}` : "";
    redirect(`/login${qs}`);
  }

  let name = "Hina";
  try {
    name = getSetting("user_name", "Hina");
  } catch {
    // 数据库未初始化时用默认名
  }
  return <AppShell userName={name}>{children}</AppShell>;
}

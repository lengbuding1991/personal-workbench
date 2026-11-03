import { redirect } from "next/navigation";
import { getPasswordHash, isAuthed } from "@/lib/auth";
import LoginApp from "@/components/LoginApp";

export const dynamic = "force-dynamic";

export const metadata = { title: "登录 · 个人工作台" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // 只接受站内相对路径，避免被拿来做跳转钓鱼
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // 已经登录的人不用再看登录页
  if (await isAuthed()) redirect(target);

  const hasPassword = Boolean(getPasswordHash());
  return <LoginApp hasPassword={hasPassword} next={target} />;
}

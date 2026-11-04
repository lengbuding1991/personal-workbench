import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 健康检查。部署脚本靠它判断「服务真的起来了」，nginx 也可以拿它做探活。
 *
 * 故意不查数据库：服务能响应 HTTP 就算活着，
 * 数据库坏了要在页面上暴露，不该让整个站点被判定为宕机。
 *
 * 版本号优先读镜像里的 VERSION 文件（构建时写死），读不到才退回环境变量。
 * 为什么要这样：环境变量会被 NAS 图形界面里手工加的同名变量覆盖，
 * 导致页面显示的版本和实际跑的镜像不一致（2026-11-04 踩过这个坑）。
 */
function readVersion() {
  try {
    const [sha, date] = readFileSync(join(process.cwd(), "VERSION"), "utf8").trim().split("\n");
    if (sha) return { sha, built: date || "unknown" };
  } catch {
    /* 本地开发没有这个文件，走下面的兜底 */
  }
  return { sha: process.env.WORKBENCH_SHA || "dev", built: process.env.BUILD_DATE || "unknown" };
}

export async function GET() {
  const { sha, built } = readVersion();
  return NextResponse.json(
    { ok: true, sha, built, at: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}

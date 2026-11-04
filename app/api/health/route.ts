import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 健康检查。部署脚本靠它判断「服务真的起来了」，nginx 也可以拿它做探活。
 *
 * 故意不查数据库：服务能响应 HTTP 就算活着，
 * 数据库坏了要在页面上暴露，不该让整个站点被判定为宕机。
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      sha: process.env.WORKBENCH_SHA || "dev",
      // 镜像构建时间（人可读），设置页「当前版本」显示它
      built: process.env.BUILD_DATE || "unknown",
      at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

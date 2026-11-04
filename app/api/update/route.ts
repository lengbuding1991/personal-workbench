import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 手动触发工作台更新。
 *
 * 平时 watchtower 每 24 小时轮询一次镜像，这个接口让用户能在设置页
 * 点一下「立即更新」，由 workbench 容器去叫 watchtower 的 HTTP API
 * （POST /v1/update），watchtower 会拉最新镜像并重建 workbench 容器。
 *
 * 关键点：watchtower 的 /v1/update 是「同步阻塞直到更新完成」的，
 * 而更新会重建 workbench 容器（也就是把正在处理的这个请求一起杀掉）。
 * 所以这里不 await，fire-and-forget 后立刻返回，浏览器拿到「已触发」，
 * 剩下的交给 watchtower 在后台做。
 */
export async function POST() {
  const gate = await requireAuth();
  if (gate) return gate;

  const url = process.env.WATCHTOWER_URL || "http://watchtower:8080";
  const token = process.env.WATCHTOWER_TOKEN || "";

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "未配置自动更新（缺少 WATCHTOWER_TOKEN）" },
      { status: 400 },
    );
  }

  fetch(`${url}/v1/update`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {
    // 不阻塞响应；watchtower 没起来或正在更新时，这次触发自然失败。
    // 真出错会体现在「版本没变」上，用户可再点一次。
  });

  return NextResponse.json({
    ok: true,
    message: "已触发更新，约 30 秒后刷新页面即可看到新版本",
  });
}

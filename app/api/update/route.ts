import { after, NextResponse } from "next/server";
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
 * 两个坑（2026-11-05 都踩到了）：
 *
 * 1) **不能直接 fire-and-forget**。原来的写法是 `fetch(...).catch(()=>{})`
 *    然后立刻 return —— 路由处理函数一返回，Next 就把这次请求的上下文拆了，
 *    还没建立连接的那次 fetch 直接被取消。实测点 4 下只有 2 条
 *    「Updates triggered by HTTP API request.」进了 watchtower 日志。
 *    改用 Next 15 的 `after()`：它保证在响应写完之后继续执行回调，
 *    不会被请求生命周期中断。
 *
 * 2) **不能给这个 fetch 设短超时**。watchtower 的 /v1/update 是同步阻塞的，
 *    要一直拉到镜像、停掉旧容器、起新容器才返回；而「停掉旧容器」就是
 *    把我们自己杀掉，所以这个请求注定以连接中断结束。这是预期行为，
 *    不能靠 AbortSignal 提前掐，否则可能在 watchtower 刚拉到一半时断开。
 */

/** 冷却期：连点多次只会触发一次。watchtower 内部是串行的，
 *  重复请求会排队、每次多拉一遍 76MB 镜像，没必要。 */
const COOLDOWN_MS = 20_000;
let lastTriggerAt = 0;

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

  const now = Date.now();
  if (now - lastTriggerAt < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - lastTriggerAt)) / 1000);
    return NextResponse.json({
      ok: true,
      cooling: true,
      message: `刚刚已经触发过了，watchtower 正在处理（${wait} 秒后可再点）`,
    });
  }
  lastTriggerAt = now;

  // 响应写完之后再发，不会被请求生命周期取消。
  after(async () => {
    try {
      await fetch(`${url}/v1/update`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // 走到这里通常是「容器被 watchtower 停掉了」，属于成功路径的一部分，
      // 不能当失败处理。真正的失败会体现在版本号没变上。
    }
  });

  return NextResponse.json({
    ok: true,
    message: "已通知 watchtower，正在拉镜像；重建容器时页面会短暂断开，属正常",
  });
}

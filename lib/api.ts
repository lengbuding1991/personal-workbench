/**
 * 统一的请求封装。
 *
 * 为什么要它：项目里 29 处 `await fetch(...)` 里有 16 处完全没有错误处理。
 * 网络一断（NAS 重启用 watchtower 时很常见）或者服务端返回 500，这些地方
 * 会静默失败——界面什么都不说，用户以为「点了没反应」。
 *
 * 这里做三件事：
 *   1. 网络异常统一抛出一个可读的中文错误，而不是裸 TypeError
 *   2. 非 2xx 也抛出，带上服务端返回的 error 文案
 *   3. 调用方只写 try/catch 一次，不用每处判断 res.ok
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Opts = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T = unknown>(url: string, opts: Opts = {}): Promise<T> {
  const { body, headers, ...rest } = opts;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("网络连接不上，检查一下网络再试", 0);
  }

  if (res.status === 401) {
    // 会话过期：登录页以外的场景直接带回跳地址跳过去
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    throw new ApiError("登录已过期，请重新登录", 401);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    let msg = `请求失败（${res.status}）`;
    if (data && typeof data === "object" && "error" in data) {
      msg = String((data as { error: unknown }).error);
    }
    throw new ApiError(msg, res.status);
  }

  return (data ?? {}) as T;
}

/** 把任意异常转成能直接丢给 toast 的一句话。 */
export function errText(e: unknown, fallback = "操作失败了，请重试") {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

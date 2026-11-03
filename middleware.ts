/**
 * 登录保护。
 *
 * 只放行三样东西：登录页本身、登录接口、以及 Next 的静态资源。
 * 其他所有页面与接口都要求有效 session cookie，否则：
 *   · 页面请求 → 跳 /login?next=原地址
 *   · 接口请求 → 401 JSON
 *
 * 这里刻意不查数据库（middleware 跑在 edge runtime，`node:sqlite` 用不了），
 * 只判断 cookie 是否「存在且未过期」；签名校验放在服务端组件与路由里做，
 * 因为签名密钥需要读数据库里的密码哈希。没有密码哈希时（首次使用），
 * 所有请求都会被引导去 /login 设置密码。
 */
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "wb_session";
/** 标记「已经设置过密码」的 cookie，登录页据此决定显示「设置密码」还是「输入密码」 */
const SETUP_COOKIE = "wb_setup";

const PUBLIC_PATHS = ["/login", "/api/auth"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Next 的内部资源与静态文件
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico" || pathname === "/icon.svg") return true;
  if (/\.(?:png|jpe?g|webp|svg|ico|css|js|woff2?|ttf)$/i.test(pathname)) return true;
  return false;
}

function sessionLooksValid(raw: string | undefined) {
  if (!raw) return false;
  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return false;
  const exp = Number(raw.slice(0, idx));
  return Number.isFinite(exp) && exp > Date.now();
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const ok = sessionLooksValid(req.cookies.get(COOKIE_NAME)?.value);
  if (ok) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  if (isApi) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  getPasswordHash,
  hashPassword,
  isSessionValid,
  makeSessionValue,
  setPasswordHash,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 简单的登录节流：同一进程里 10 分钟内错 6 次就锁 10 分钟 */
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW = 10 * 60 * 1000;
const LIMIT = 6;

function clientKey(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

function locked(key: string) {
  const rec = attempts.get(key);
  if (!rec) return 0;
  if (rec.until > Date.now()) return Math.ceil((rec.until - Date.now()) / 1000);
  if (rec.count >= LIMIT) {
    attempts.delete(key);
    return 0;
  }
  return 0;
}

function fail(key: string) {
  const now = Date.now();
  const rec = attempts.get(key) ?? { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= LIMIT) rec.until = now + WINDOW;
  attempts.set(key, rec);
  return Math.max(0, LIMIT - rec.count);
}

const Body = z.object({
  password: z.string().min(1).max(200),
  /** 首次设置密码时，要输两遍 */
  confirm: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const key = clientKey(req);
  const wait = locked(key);
  if (wait > 0) {
    return NextResponse.json({ error: `试太多次了，${wait} 秒后再来` }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const { password, confirm } = parsed.data;

  const stored = getPasswordHash();

  /* 第一次使用：设置密码 */
  if (!stored) {
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }
    if (confirm !== undefined && confirm !== password) {
      return NextResponse.json({ error: "两次输入不一致" }, { status: 400 });
    }
    const hash = hashPassword(password);
    setPasswordHash(hash);
    const res = NextResponse.json({ ok: true, created: true });
    res.cookies.set(COOKIE_NAME, makeSessionValue(hash), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
      secure: process.env.WB_SECURE_COOKIE === "1",
    });
    return res;
  }

  /* 已有密码：校验 */
  if (!verifyPassword(password, stored)) {
    const left = fail(key);
    if (left <= 0) {
      return NextResponse.json({ error: "试太多次了，10 分钟后再来" }, { status: 429 });
    }
    return NextResponse.json({ error: `密码不对，还能试 ${left} 次` }, { status: 401 });
  }

  attempts.delete(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, makeSessionValue(stored), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.WB_SECURE_COOKIE === "1",
  });
  return res;
}

/** 退出：清掉 cookie */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

/** 修改密码（已登录才可用），成功后自动续一个新 cookie */
const Change = z.object({
  current: z.string().min(1).max(200),
  password: z.string().min(6).max(200),
});

export async function PATCH(req: Request) {
  const stored0 = getPasswordHash();
  const jar = await import("next/headers").then((m) => m.cookies());
  if (!isSessionValid(jar.get(COOKIE_NAME)?.value, stored0)) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const parsed = Change.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "新密码至少 6 位" }, { status: 400 });

  const { current, password } = parsed.data;
  if (!verifyPassword(current, stored0)) {
    return NextResponse.json({ error: "当前密码不对" }, { status: 401 });
  }

  const hash = hashPassword(password);
  setPasswordHash(hash);
  const res = NextResponse.json({ ok: true });
  // 密码哈希变了 → 旧的签名密钥也变了，这里必须换发新 cookie，
  // 否则当前这台设备会被自己踢下线
  res.cookies.set(COOKIE_NAME, makeSessionValue(hash), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.WB_SECURE_COOKIE === "1",
  });
  return res;
}

/** 查询当前状态（登录页用它决定显示「设置密码」还是「输入密码」） */
export async function GET() {
  const stored = getPasswordHash();
  const jar = await import("next/headers").then((m) => m.cookies());
  const authed = isSessionValid(jar.get(COOKIE_NAME)?.value, stored);
  return NextResponse.json({ hasPassword: Boolean(stored), authed });
}

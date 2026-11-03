import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSetting, setSetting } from "@/lib/db";

/**
 * 单用户登录。
 *
 * 只保护「别人能不能打开这个页面」，不区分权限 —— 这是单人工作台，
 * 登录后看到的是同一份数据。所以设计上尽量少：
 *   · 密码用 scrypt 加盐存 SQLite（setting 表），不存明文
 *   · 登录成功发一个 HMAC 签名的 cookie（24 小时），服务端不存 session 表
 *   · 改密码会让 cookie 里的签名失效（密钥跟随密码哈希变化）
 *
 * 密钥从哪来：cookie 的签名密钥 = HMAC(密码哈希, 固定串)，
 * 所以改密码时旧 cookie 自动失效，不需要额外的失效名单。
 */

export const COOKIE_NAME = "wb_session";
const MAX_AGE = 60 * 60 * 24; // 24 小时
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export type AuthState = {
  /** 是否已设置密码。false 表示首次使用，引导去设置密码 */
  hasPassword: boolean;
  /** 当前请求是否已登录 */
  authed: boolean;
};

/* ---------------- 密码 ---------------- */

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, SCRYPT).toString("hex");
  // 格式：scrypt$N$r$p$salt$hash，方便以后换参数
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "hex");
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
  } catch {
    return false;
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ---------------- 设置读写 ---------------- */

export function getPasswordHash() {
  return getSetting("auth_hash", "");
}

export function setPasswordHash(hash: string) {
  setSetting("auth_hash", hash);
}

export function getAuthState(): AuthState {
  const stored = getPasswordHash();
  return { hasPassword: Boolean(stored), authed: false };
}

/* ---------------- Cookie 签名 ---------------- */

function secretFor(stored: string) {
  // 密码哈希变了，secret 就变，旧签名自动失效
  return createHmac("sha256", stored).update("workbench-session-v1").digest();
}

function sign(stored: string, payload: string) {
  return createHmac("sha256", secretFor(stored)).update(payload).digest("base64url");
}

/** cookie 值：<过期时间戳>.<签名> */
export function makeSessionValue(stored: string) {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = String(exp);
  return `${payload}.${sign(stored, payload)}`;
}

export function isSessionValid(value: string | undefined, stored: string) {
  if (!value || !stored) return false;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return false;
  const payload = value.slice(0, idx);
  const mac = value.slice(idx + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = sign(stored, payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------------- 请求侧 ---------------- */

/** 服务端组件 / 路由里判断是否已登录 */
export async function isAuthed() {
  const stored = getPasswordHash();
  if (!stored) return false;
  const jar = await cookies();
  return isSessionValid(jar.get(COOKIE_NAME)?.value, stored);
}

/** 给路由处理器用：没登录直接返回 401 响应 */
export async function requireAuth() {
  if (await isAuthed()) return null;
  return new Response(JSON.stringify({ error: "未登录" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export const SESSION_MAX_AGE = MAX_AGE;

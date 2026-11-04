import { NextResponse } from "next/server";
import fs from "node:fs";
import { join } from "node:path";
import { requireAuth } from "@/lib/auth";
import { getDb, todayLocal } from "@/lib/db";

/** 数据库文件路径。和 lib/db.ts 里 getDb() 用的是同一套规则。 */
function dbFilePath() {
  const dir = process.env.WORKBENCH_DATA_DIR || join(process.cwd(), "data");
  return join(dir, "workbench.db");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 下载完整的 workbench.db 文件。
 *
 * 和 /api/export 的区别：那个导出的是 JSON（给人看、能读），
 * 这个是原始 SQLite 文件（给机器用、能直接换上去）。
 * 想要「在别的机器上原地恢复」就下这个。
 *
 * 注意：直接读文件前先 checkpoint，否则最近的写入还在 -wal 里，
 * 下载到的文件会缺最后一小段数据。
 */
export async function GET() {
  const gate = await requireAuth();
  if (gate) return gate;

  const file = dbFilePath();
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "数据库文件不存在" }, { status: 404 });
  }

  try {
    getDb().exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
    /* 有并发访问时拿不到排他锁，退而求其次直接读，可能少最后几条 */
  }

  const buf = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Length": String(buf.length),
      "Content-Disposition": `attachment; filename="workbench-${todayLocal()}.db"`,
      "cache-control": "no-store",
    },
  });
}

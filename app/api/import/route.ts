import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Any = Record<string, unknown>;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown) => (typeof v === "number" ? v : null);
const opt = (v: unknown) => (typeof v === "string" ? v : null);

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  let data: Any;
  try {
    data = (await req.json()) as Any;
  } catch {
    return NextResponse.json({ error: "不是合法的 JSON 文件" }, { status: 400 });
  }
  if (!data || typeof data !== "object") return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
  const db = getDb();
  const now = nowIso();
  let n = 0;

  const tx = db.prepare("SELECT 1");
  tx.get();
  try {
    db.exec("BEGIN");
    for (const raw of Array.isArray(data.task) ? (data.task as Any[]) : []) {
      db.prepare(
        `INSERT INTO task (title,note,status,priority,area,project,tags,due_date,scheduled_start,scheduled_end,estimate_min,done_at,sort,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        str(raw.title, "导入任务"), str(raw.note), str(raw.status, "todo"), str(raw.priority, "med"), str(raw.area, "work"),
        str(raw.project), str(raw.tags), opt(raw.due_date), opt(raw.scheduled_start), opt(raw.scheduled_end),
        num(raw.estimate_min), opt(raw.done_at), num(raw.sort) ?? 0, str(raw.created_at, now), str(raw.updated_at, now)
      );
      n++;
    }
    for (const raw of Array.isArray(data.note) ? (data.note as Any[]) : []) {
      db.prepare("INSERT INTO note (title,content,source,tags,archived,pinned,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(str(raw.title), str(raw.content), str(raw.source, "导入"), str(raw.tags), raw.archived ? 1 : 0, raw.pinned ? 1 : 0, str(raw.created_at, now), str(raw.updated_at, now));
      n++;
    }
    for (const raw of Array.isArray(data.event) ? (data.event as Any[]) : []) {
      if (!raw.start_at) continue;
      db.prepare("INSERT INTO event (title,start_at,end_at,all_day,location,note,created_at) VALUES (?,?,?,?,?,?,?)")
        .run(str(raw.title, "导入日程"), str(raw.start_at, ""), opt(raw.end_at), raw.all_day ? 1 : 0, str(raw.location), str(raw.note), str(raw.created_at, now));
      n++;
    }
    for (const raw of Array.isArray(data.review) ? (data.review as Any[]) : []) {
      if (!raw.date) continue;
      db.prepare(
        `INSERT INTO review (date,type,did,stuck,tomorrow,summary,ai_generated,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(date,type) DO UPDATE SET did=excluded.did, stuck=excluded.stuck, tomorrow=excluded.tomorrow, summary=excluded.summary`
      ).run(str(raw.date), str(raw.type, "daily"), str(raw.did), str(raw.stuck), str(raw.tomorrow), str(raw.summary), raw.ai_generated ? 1 : 0, now, now);
      n++;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: `导入失败：${e instanceof Error ? e.message : "未知错误"}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, imported: n });
}

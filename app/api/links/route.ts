import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 记录 ↔ 任务 的关联。
 *
 * 用法：
 *   GET  /api/links?note=3   → 这条记录关联了哪些任务
 *   GET  /api/links?task=5   → 这个任务被哪些记录提到
 *   POST /api/links           → 建立关联（body: {note_id, task_id}）
 *   DELETE /api/links         → 解除关联（body: {note_id, task_id}）
 */
const Link = z.object({
  note_id: z.number().int().positive(),
  task_id: z.number().int().positive(),
});

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const url = new URL(req.url);
  const db = getDb();
  const noteId = Number(url.searchParams.get("note") || 0);
  const taskId = Number(url.searchParams.get("task") || 0);

  if (noteId) {
    const links = db
      .prepare(
        `SELECT l.id, l.created_at, t.id AS task_id, t.title, t.status, t.due_date, t.priority, t.area
         FROM note_task l JOIN task t ON t.id = l.task_id
         WHERE l.note_id = ? ORDER BY l.id`
      )
      .all(noteId);
    return NextResponse.json({ links });
  }
  if (taskId) {
    const links = db
      .prepare(
        `SELECT l.id, l.created_at, n.id AS note_id, n.title, n.content, n.updated_at
         FROM note_task l JOIN note n ON n.id = l.note_id
         WHERE l.task_id = ? ORDER BY l.id`
      )
      .all(taskId);
    return NextResponse.json({ links });
  }
  return NextResponse.json({ error: "要指定 note 或 task" }, { status: 400 });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Link.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const { note_id, task_id } = parsed.data;
  const db = getDb();
  const note = db.prepare("SELECT id FROM note WHERE id=?").get(note_id);
  const task = db.prepare("SELECT id FROM task WHERE id=?").get(task_id);
  if (!note || !task) return NextResponse.json({ error: "记录或任务不存在" }, { status: 404 });
  db.prepare("INSERT OR IGNORE INTO note_task (note_id, task_id, created_at) VALUES (?,?,?)").run(
    note_id,
    task_id,
    nowIso()
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Link.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  getDb().prepare("DELETE FROM note_task WHERE note_id=? AND task_id=?").run(parsed.data.note_id, parsed.data.task_id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  title: z.string().min(1).max(300),
  note: z.string().max(2000).optional().default(""),
  area: z.enum(["work", "side", "media", "study", "life"]).optional().default("work"),
  priority: z.enum(["high", "med", "low"]).optional().default("med"),
  status: z.enum(["todo", "doing", "done"]).optional().default("todo"),
  due_date: z.string().nullable().optional(),
  scheduled_start: z.string().nullable().optional(),
  scheduled_end: z.string().nullable().optional(),
  estimate_min: z.number().int().nullable().optional(),
  project: z.string().max(80).optional().default(""),
  tags: z.string().max(300).optional().default(""),
});

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  const db = getDb();
  let sql = "SELECT * FROM task WHERE 1=1";
  const args: unknown[] = [];
  if (status && ["todo", "doing", "done"].includes(status)) {
    sql += " AND status = ?";
    args.push(status);
  }
  if (q) {
    sql += " AND (title LIKE ? OR note LIKE ?)";
    args.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, sort, id DESC";
  const rows = db.prepare(sql).all(...(args as (string | number | null)[]));
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const body = await req.json();
  const parsed = Create.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数不合法", detail: parsed.error.flatten() }, { status: 400 });
  const t = parsed.data;
  const now = nowIso();
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO task (title,note,status,priority,area,due_date,scheduled_start,scheduled_end,estimate_min,project,tags,done_at,sort,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`
    )
    .run(
      t.title,
      t.note ?? "",
      t.status ?? "todo",
      t.priority ?? "med",
      t.area ?? "work",
      t.due_date ?? null,
      t.scheduled_start ?? null,
      t.scheduled_end ?? null,
      t.estimate_min ?? null,
      t.project ?? "",
      t.tags ?? "",
      t.status === "done" ? now : null,
      now,
      now
    );
  return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
}

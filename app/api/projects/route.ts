import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso, rows, row } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  name: z.string().min(1).max(80),
  color: z.string().max(20).optional().default("#9B8AE6"),
  area: z.enum(["work", "side", "media", "study", "life"]).optional().default("work"),
  note: z.string().max(500).optional().default(""),
  target_date: z.string().max(30).nullable().optional(),
});

export type Project = {
  id: number;
  name: string;
  color: string;
  area: string;
  status: string;
  note: string;
  sort: number;
  created_at: string;
  /** 想什么时候做完（可空） */
  target_date?: string | null;
};

export async function GET() {
  const gate = await requireAuth();
  if (gate) return gate;
  const db = getDb();
  // 带上每个项目的任务统计，省得前端再查一遍
  const list = rows<Project & { total: number; done: number }>(
    db,
    `SELECT p.*,
       (SELECT COUNT(*) FROM task t WHERE t.project_id = p.id) AS total,
       (SELECT COUNT(*) FROM task t WHERE t.project_id = p.id AND t.status='done') AS done
     FROM project p ORDER BY p.sort, p.id`
  );
  return NextResponse.json({ projects: list });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Create.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const p = parsed.data;
  const db = getDb();
  const now = nowIso();
  const info = db
    .prepare("INSERT INTO project (name,color,area,status,note,sort,target_date,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(p.name, p.color, p.area, "active", p.note ?? "", 0, p.target_date ?? null, now);
  const created = row<Project>(db, "SELECT * FROM project WHERE id=?", Number(info.lastInsertRowid));
  return NextResponse.json({ project: created }, { status: 201 });
}

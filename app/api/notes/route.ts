import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  title: z.string().max(300).optional().default(""),
  content: z.string().max(20000).optional().default(""),
  source: z.string().max(50).optional().default("灵感"),
  tags: z.string().max(300).optional().default(""),
  archived: z.union([z.literal(0), z.literal(1)]).optional().default(0),
  pinned: z.union([z.literal(0), z.literal(1)]).optional().default(0),
});

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const includeArchived = url.searchParams.get("archived") === "1";
  const db = getDb();
  const arch = includeArchived ? "" : " AND archived = 0";
  const rows = q
    ? db.prepare(`SELECT * FROM note WHERE (title LIKE ? OR content LIKE ?)${arch} ORDER BY pinned DESC, updated_at DESC`).all(`%${q}%`, `%${q}%`)
    : db.prepare(`SELECT * FROM note WHERE 1=1${arch} ORDER BY pinned DESC, updated_at DESC`).all();
  return NextResponse.json({ notes: rows });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Create.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const t = parsed.data;
  const now = nowIso();
  const info = getDb()
    .prepare("INSERT INTO note (title,content,source,tags,archived,pinned,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(t.title ?? "", t.content ?? "", t.source ?? "灵感", t.tags ?? "", t.archived ?? 0, t.pinned ?? 0, now, now);
  const note = getDb().prepare("SELECT * FROM note WHERE id=?").get(Number(info.lastInsertRowid));
  return NextResponse.json({ note }, { status: 201 });
}

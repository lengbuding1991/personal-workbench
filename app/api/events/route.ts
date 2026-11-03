import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  title: z.string().min(1).max(300),
  start_at: z.string().min(10),
  end_at: z.string().nullable().optional(),
  all_day: z.number().int().min(0).max(1).optional().default(0),
  location: z.string().max(200).optional().default(""),
  note: z.string().max(2000).optional().default(""),
});

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const db = getDb();
  const rows = from && to
    ? db.prepare("SELECT * FROM event WHERE start_at >= ? AND start_at < ? ORDER BY start_at").all(from, to)
    : db.prepare("SELECT * FROM event ORDER BY start_at").all();
  return NextResponse.json({ events: rows });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Create.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const t = parsed.data;
  const info = getDb()
    .prepare("INSERT INTO event (title,start_at,end_at,all_day,location,note,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(t.title, t.start_at, t.end_at ?? null, t.all_day ?? 0, t.location ?? "", t.note ?? "", nowIso());
  return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
}

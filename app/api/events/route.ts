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
  repeat_rule: z.enum(["none", "daily", "weekdays", "weekly", "monthly"]).optional().default("none"),
  remind_min: z.number().int().min(0).max(10080).nullable().optional(),
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
  const db = getDb();
  const info = db
    .prepare("INSERT INTO event (title,start_at,end_at,all_day,location,note,repeat_rule,remind_min,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(
      t.title,
      t.start_at,
      t.end_at ?? null,
      t.all_day ?? 0,
      t.location ?? "",
      t.note ?? "",
      t.repeat_rule ?? "none",
      t.remind_min ?? null,
      nowIso()
    );
  // 返回完整行（和 PATCH 一致），前端 save 靠 data.event 把它加进本地列表
  const event = db.prepare("SELECT * FROM event WHERE id=?").get(Number(info.lastInsertRowid));
  return NextResponse.json({ event: event ? { ...event } : null }, { status: 201 });
}

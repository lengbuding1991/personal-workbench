import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso, row } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { dayKey, lastDays, LOOKBACK, loadHabits } from "@/lib/habits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  habit_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** 打卡 / 取消打卡（同一个接口来回切） */
export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });

  const db = getDb();
  const habit = row<{ id: number }>(db, "SELECT id FROM habit WHERE id=?", parsed.data.habit_id);
  if (!habit) return NextResponse.json({ error: "这个习惯不存在了" }, { status: 404 });

  const today = dayKey();
  const date = parsed.data.date ?? today;
  if (date > today) return NextResponse.json({ error: "还没到那天，不能提前打卡" }, { status: 400 });
  if (!lastDays(LOOKBACK).includes(date)) {
    return NextResponse.json({ error: `只能补最近 ${LOOKBACK} 天` }, { status: 400 });
  }

  const existed = row<{ id: number }>(
    db,
    "SELECT id FROM habit_log WHERE habit_id=? AND date=?",
    parsed.data.habit_id,
    date,
  );
  if (existed) db.prepare("DELETE FROM habit_log WHERE id=?").run(existed.id);
  else
    db.prepare("INSERT INTO habit_log (habit_id,date,created_at) VALUES (?,?,?)").run(
      parsed.data.habit_id,
      date,
      nowIso(),
    );

  return NextResponse.json({ ...loadHabits(db), done: !existed, date });
}

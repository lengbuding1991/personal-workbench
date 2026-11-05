import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso, row } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { loadHabits, type Habit } from "@/lib/habits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().max(20).optional(),
});

export async function GET() {
  const gate = await requireAuth();
  if (gate) return gate;
  return NextResponse.json(loadHabits(getDb()));
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Create.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "习惯名不能为空，最多 40 个字" }, { status: 400 });
  }
  const db = getDb();
  const max = row<{ n: number | null }>(db, "SELECT MAX(sort) AS n FROM habit");
  const info = db
    .prepare("INSERT INTO habit (name,color,sort,archived,created_at) VALUES (?,?,?,0,?)")
    .run(parsed.data.name, parsed.data.color || "#3AC8C2", (max?.n ?? 0) + 1, nowIso());
  const habit = row<Habit>(db, "SELECT * FROM habit WHERE id=?", Number(info.lastInsertRowid));
  return NextResponse.json({ ...loadHabits(db), habit }, { status: 201 });
}

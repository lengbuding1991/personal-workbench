import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, row } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { loadHabits, type Habit } from "@/lib/habits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  color: z.string().max(20).optional(),
  sort: z.number().int().optional(),
  archived: z.union([z.literal(0), z.literal(1)]).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (gate) return gate;
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });

  const db = getDb();
  if (!row<{ id: number }>(db, "SELECT id FROM habit WHERE id=?", n)) {
    return NextResponse.json({ error: "这个习惯不存在了" }, { status: 404 });
  }

  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    fields.push(`${k} = ?`);
    args.push(v as string | number);
  }
  if (!fields.length) return NextResponse.json({ ok: true });
  args.push(n);
  db.prepare(`UPDATE habit SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  const habit = row<Habit>(db, "SELECT * FROM habit WHERE id=?", n);
  return NextResponse.json({ ...loadHabits(db), habit });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (gate) return gate;
  const { id } = await ctx.params;
  const db = getDb();
  // habit_log 有 ON DELETE CASCADE，删习惯会连打卡记录一起清掉
  db.prepare("DELETE FROM habit WHERE id=?").run(Number(id));
  return NextResponse.json(loadHabits(db));
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso, row } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().max(20).optional(),
  area: z.enum(["work", "side", "media", "study", "life"]).optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  note: z.string().max(500).optional(),
  sort: z.number().int().optional(),
  target_date: z.string().max(30).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (gate) return gate;
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });

  const db = getDb();
  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    fields.push(`${k} = ?`);
    args.push(v as string | number | null);
  }
  if (!fields.length) return NextResponse.json({ ok: true });
  args.push(n);
  db.prepare(`UPDATE project SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  const project = row(db, "SELECT * FROM project WHERE id = ?", n);
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (gate) return gate;
  const { id } = await ctx.params;
  const n = Number(id);
  const db = getDb();
  // 删项目不删任务：把任务的项目归属清掉，任务本身留着
  db.prepare("UPDATE task SET project_id = NULL, updated_at = ? WHERE project_id = ?").run(nowIso(), n);
  const info = db.prepare("DELETE FROM project WHERE id = ?").run(n);
  if (info.changes === 0) return NextResponse.json({ error: "这个项目已经不存在了" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

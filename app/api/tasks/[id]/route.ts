import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  title: z.string().min(1).max(300).optional(),
  note: z.string().max(4000).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  priority: z.enum(["high", "med", "low"]).optional(),
  area: z.enum(["work", "side", "media", "study", "life"]).optional(),
  due_date: z.string().nullable().optional(),
  scheduled_start: z.string().nullable().optional(),
  scheduled_end: z.string().nullable().optional(),
  estimate_min: z.number().int().nullable().optional(),
  project: z.string().max(80).optional(),
  tags: z.string().max(300).optional(),
  sort: z.number().int().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = await req.json();
  const parsed = Patch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const db = getDb();
  const before = db.prepare("SELECT * FROM task WHERE id=?").get(n) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  const fields: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    fields.push(`${k} = ?`);
    args.push(v);
  }
  if (parsed.data.status) {
    fields.push("done_at = ?");
    args.push(parsed.data.status === "done" ? nowIso() : null);
  }
  if (!fields.length) return NextResponse.json({ ok: true });
  fields.push("updated_at = ?");
  args.push(nowIso());
  args.push(n);
  db.prepare(`UPDATE task SET ${fields.join(", ")} WHERE id = ?`).run(...(args as (string | number | null)[]));
  const task = db.prepare("SELECT * FROM task WHERE id=?").get(n);
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  getDb().prepare("DELETE FROM task WHERE id=?").run(n);
  return NextResponse.json({ ok: true });
}

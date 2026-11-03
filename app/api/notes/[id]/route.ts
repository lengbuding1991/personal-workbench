import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(50000).optional(),
  source: z.string().max(50).optional(),
  tags: z.string().max(300).optional(),
  archived: z.union([z.literal(0), z.literal(1)]).optional(),
  pinned: z.union([z.literal(0), z.literal(1)]).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const fields: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    fields.push(`${k} = ?`);
    args.push(v);
  }
  if (!fields.length) return NextResponse.json({ ok: true });
  fields.push("updated_at = ?");
  args.push(nowIso(), n);
  getDb().prepare(`UPDATE note SET ${fields.join(", ")} WHERE id = ?`).run(...(args as (string | number | null)[]));
  return NextResponse.json({ note: getDb().prepare("SELECT * FROM note WHERE id=?").get(n) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM note WHERE id=?").run(Number(id));
  return NextResponse.json({ ok: true });
}

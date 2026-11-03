import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  title: z.string().min(1).max(160).optional(),
  start_at: z.string().optional(),
  end_at: z.string().nullable().optional(),
  all_day: z.number().int().optional(),
  location: z.string().max(160).optional(),
  note: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (gate) return gate;
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const parsed = Patch.safeParse(await req.json());
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
  db.prepare(`UPDATE event SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  const event = db.prepare("SELECT * FROM event WHERE id=?").get(n);
  return NextResponse.json({ event });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (gate) return gate;
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM event WHERE id=?").run(Number(id));
  return NextResponse.json({ ok: true });
}

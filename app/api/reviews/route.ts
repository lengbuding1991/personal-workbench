import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Save = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["daily", "weekly"]).optional().default("daily"),
  did: z.string().max(4000).optional().default(""),
  stuck: z.string().max(4000).optional().default(""),
  tomorrow: z.string().max(4000).optional().default(""),
  summary: z.string().max(8000).optional().default(""),
  ai_generated: z.number().int().min(0).max(1).optional().default(0),
});

export async function GET() {
  const gate = await requireAuth();
  if (gate) return gate;
  const rows = getDb().prepare("SELECT * FROM review ORDER BY date DESC LIMIT 30").all();
  return NextResponse.json({ reviews: rows });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Save.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const t = parsed.data;
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO review (date,type,did,stuck,tomorrow,summary,ai_generated,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(date,type) DO UPDATE SET did=excluded.did, stuck=excluded.stuck, tomorrow=excluded.tomorrow,
         summary=excluded.summary, ai_generated=excluded.ai_generated, updated_at=excluded.updated_at`
    )
    .run(t.date, t.type ?? "daily", t.did ?? "", t.stuck ?? "", t.tomorrow ?? "", t.summary ?? "", t.ai_generated ?? 0, now, now);
  return NextResponse.json({ ok: true });
}

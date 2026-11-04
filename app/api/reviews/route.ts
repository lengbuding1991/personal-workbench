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
  // 四个正文框全空就没有记录的价值。前端已经拦了一道，
  // 这里再拦一次是防止直接调接口写进空壳（历史里出现过「（空白）」条目）。
  if (![t.did, t.stuck, t.tomorrow, t.summary].some((v) => (v ?? "").trim())) {
    return NextResponse.json({ error: "写一句再保存吧" }, { status: 400 });
  }
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

const Del = z.object({ id: z.number().int().positive() });

/** 删掉一篇历史复盘。写错了得能删，不然一篇误存的内容会一直挂在历史里。 */
export async function DELETE(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Del.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const info = getDb().prepare("DELETE FROM review WHERE id=?").run(parsed.data.id);
  if (info.changes === 0) return NextResponse.json({ error: "这篇复盘已经不存在了" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

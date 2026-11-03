import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, setSetting } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readAll() {
  const rows = getDb().prepare("SELECT key,value FROM setting").all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function GET() {
  const s = readAll();
  return NextResponse.json({
    user_name: s.user_name ?? "Hina",
    ai_base_url: s.ai_base_url ?? "https://api.deepseek.com",
    ai_model: s.ai_model ?? "deepseek-chat",
    ai_key_set: Boolean(s.ai_key),
  });
}

const Patch = z.object({
  user_name: z.string().min(1).max(50).optional(),
  ai_base_url: z.string().url().optional(),
  ai_model: z.string().min(1).max(100).optional(),
  ai_key: z.string().max(200).optional(),
});

export async function PATCH(req: Request) {
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k === "ai_key" && !v) continue;
    setSetting(k, String(v));
  }
  return NextResponse.json({ ok: true });
}

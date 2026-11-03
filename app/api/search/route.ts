import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ tasks: [], notes: [] });
  const db = getDb();
  const tasks = db
    .prepare("SELECT id,title,status FROM task WHERE title LIKE ? OR note LIKE ? ORDER BY updated_at DESC LIMIT 8")
    .all(`%${q}%`, `%${q}%`)
    .map((r) => ({ ...(r as object), kind: "task" }));
  const notes = db
    .prepare("SELECT id,title FROM note WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT 8")
    .all(`%${q}%`, `%${q}%`)
    .map((r) => ({ ...(r as object), kind: "note" }));
  return NextResponse.json({ tasks, notes });
}

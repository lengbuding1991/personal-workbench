import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { search } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 全局搜索（命令面板和搜索页都打这个）。逻辑见 lib/search.ts。 */
export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const kind = url.searchParams.get("kind") || "all";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  if (!q) return NextResponse.json({ hits: [], total: 0, tasks: [], notes: [] });

  const hits = search(getDb(), q, { kind, from, to });

  return NextResponse.json({
    hits: hits.slice(0, 60),
    total: hits.length,
    // 兼容命令面板（它只看 tasks / notes 两个数组）
    tasks: hits.filter((h) => h.kind === "task").slice(0, 8).map((h) => ({ id: h.id, title: h.title, status: h.status ?? "" })),
    notes: hits.filter((h) => h.kind === "note").slice(0, 8).map((h) => ({ id: h.id, title: h.title })),
  });
}

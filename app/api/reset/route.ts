import { NextResponse } from "next/server";
import { getDb, setSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireAuth();
  if (gate) return gate;
  const db = getDb();
  db.exec("BEGIN");
  try {
    for (const table of ["task", "event", "note", "review", "reminder", "external_ref", "note_task"]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    setSetting("initialized", "1");
    db.exec("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "清空失败" }, { status: 500 });
  }
}

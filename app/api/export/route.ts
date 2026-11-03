import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const tables = ["task", "event", "note", "review", "project", "external_ref"];
  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    version: 1,
  };
  for (const t of tables) data[t] = db.prepare(`SELECT * FROM ${t}`).all();
  const settings = db.prepare("SELECT key,value FROM setting").all() as { key: string; value: string }[];
  data.settings = Object.fromEntries(settings.filter((s) => s.key !== "ai_key").map((s) => [s.key, s.value]));
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="workbench-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/lib/db";
import SettingsApp from "@/components/SettingsApp";

/** 和 /api/health 同一套规则：优先读镜像里的 VERSION 文件，读不到才用环境变量。 */
function versionInfo() {
  try {
    const [sha, date] = readFileSync(join(process.cwd(), "VERSION"), "utf8").trim().split("\n");
    if (sha) return { sha, built: date || "" };
  } catch {
    /* 本地开发没这个文件 */
  }
  return { sha: process.env.WORKBENCH_SHA || "dev", built: process.env.BUILD_DATE || "" };
}

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const rows = db.prepare("SELECT key,value FROM setting").all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  const count = (sql: string) => Number((db.prepare(sql).get() as { n: number }).n);
  const stats = {
    tasks: count("SELECT COUNT(*) AS n FROM task"),
    done: count("SELECT COUNT(*) AS n FROM task WHERE status='done'"),
    notes: count("SELECT COUNT(*) AS n FROM note"),
    events: count("SELECT COUNT(*) AS n FROM event"),
    reviews: count("SELECT COUNT(*) AS n FROM review"),
  };
  const v = versionInfo();
  return (
    <SettingsApp
      initial={{
        user_name: map.user_name ?? "Hina",
        ai_base_url: map.ai_base_url ?? "https://api.deepseek.com",
        ai_model: map.ai_model ?? "deepseek-chat",
        ai_key_set: Boolean(map.ai_key),
        stats,
        version: v.sha,
        built: v.built,
      }}
    />
  );
}

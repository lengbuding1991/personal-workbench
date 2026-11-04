import { getDb } from "@/lib/db";
import SettingsApp from "@/components/SettingsApp";

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
  return (
    <SettingsApp
      initial={{
        user_name: map.user_name ?? "Hina",
        ai_base_url: map.ai_base_url ?? "https://api.deepseek.com",
        ai_model: map.ai_model ?? "deepseek-chat",
        ai_key_set: Boolean(map.ai_key),
        stats,
        version: process.env.WORKBENCH_SHA || "dev",
        built: process.env.BUILD_DATE || "",
      }}
    />
  );
}

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { startOfWeek, addDays, formatISO } from "date-fns";

export type TaskStatus = "todo" | "doing" | "done";
export type Priority = "high" | "med" | "low";
export type Area = "work" | "side" | "media" | "study" | "life";

export type Task = {
  id: number;
  title: string;
  note: string;
  status: TaskStatus;
  priority: Priority;
  area: Area;
  project_id: number | null;
  project: string;
  tags: string;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimate_min: number | null;
  done_at: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: number;
  title: string;
  content: string;
  source: string;
  tags: string;
  archived: 0 | 1;
  pinned: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: 0 | 1;
  location: string;
  note: string;
  created_at: string;
};

export type Review = {
  id: number;
  date: string;
  type: "daily" | "weekly";
  did: string;
  stuck: string;
  tomorrow: string;
  summary: string;
  ai_generated: 0 | 1;
  created_at: string;
  updated_at: string;
};

type GlobalWithDb = typeof globalThis & { __workbenchDb?: DatabaseSync };

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#9B8AE6',
  area TEXT NOT NULL DEFAULT 'work',
  status TEXT NOT NULL DEFAULT 'active',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  priority TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('high','med','low')),
  area TEXT NOT NULL DEFAULT 'work' CHECK (area IN ('work','side','media','study','life')),
  project_id INTEGER REFERENCES project(id) ON DELETE SET NULL,
  due_date TEXT,
  scheduled_start TEXT,
  scheduled_end TEXT,
  estimate_min INTEGER,
  done_at TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_status ON task(status);
CREATE INDEX IF NOT EXISTS idx_task_due ON task(due_date);

CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_start ON event(start_at);

CREATE TABLE IF NOT EXISTS note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '灵感',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'daily',
  did TEXT NOT NULL DEFAULT '',
  stuck TEXT NOT NULL DEFAULT '',
  tomorrow TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  ai_generated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(date, type)
);

CREATE TABLE IF NOT EXISTS reminder (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  remind_at TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'inapp',
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS external_ref (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  kb_type TEXT NOT NULL,
  kb_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  input TEXT NOT NULL DEFAULT '',
  output TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`;

function seed(db: DatabaseSync) {
  const now = new Date();
  const iso = (d: Date) => formatISO(d, { representation: "complete" });
  const day = (offset: number, h = 9, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(h, m, 0, 0);
    return iso(d);
  };
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const wd = (i: number, h: number, m = 0) => {
    const d = addDays(weekStart, i);
    d.setHours(h, m, 0, 0);
    return iso(d);
  };
  const today = iso(now);

  const insertTask = db.prepare(
    `INSERT INTO task (title,note,status,priority,area,due_date,scheduled_start,scheduled_end,estimate_min,done_at,sort,created_at,updated_at)
     VALUES (@title,@note,@status,@priority,@area,@due_date,@scheduled_start,@scheduled_end,@estimate_min,@done_at,@sort,@created_at,@updated_at)`
  );

  const tasks = [
    { title: "客户方案二稿：补三个真实案例", note: "把上次评审提的三个场景补齐", status: "todo", priority: "high", area: "work", due_date: day(2).slice(0, 10), scheduled_start: wd(0, 11), scheduled_end: wd(0, 12), estimate_min: 50, sort: 0 },
    { title: "整理本周采集的选题素材", note: "", status: "todo", priority: "med", area: "media", due_date: null, scheduled_start: wd(2, 9), scheduled_end: wd(2, 10), estimate_min: 40, sort: 1 },
    { title: "论文第 4 章笔记 + 变量表", note: "", status: "todo", priority: "med", area: "study", due_date: day(3).slice(0, 10), scheduled_start: wd(4, 16), scheduled_end: wd(6, 18), estimate_min: 90, sort: 2 },
    { title: "买一袋咖啡豆", note: "", status: "todo", priority: "low", area: "life", due_date: null, scheduled_start: null, scheduled_end: null, estimate_min: 10, sort: 3 },
    { title: "录「个人工作台」短视频", note: "脚本已就绪，先拍 3 条素材", status: "doing", priority: "high", area: "media", due_date: today.slice(0, 10), scheduled_start: wd(3, 14), scheduled_end: wd(3, 15), estimate_min: 60, sort: 0 },
    { title: "晨间计划", note: "10 分钟，列三件要紧事", status: "done", priority: "low", area: "life", due_date: today.slice(0, 10), scheduled_start: wd(0, 8, 30), scheduled_end: null, estimate_min: 10, done_at: day(0, 8, 40), sort: 0 },
    { title: "回复客户邮件", note: "", status: "done", priority: "med", area: "work", due_date: today.slice(0, 10), scheduled_start: null, scheduled_end: null, estimate_min: 15, done_at: day(0, 8, 50), sort: 1 },
  ];
  for (const t of tasks) {
    insertTask.run({
      ...t,
      done_at: (t as { done_at?: string }).done_at ?? null,
      created_at: day(-3, 9),
      updated_at: day(0, 9),
    });
  }

  const insertEvent = db.prepare(
    `INSERT INTO event (title,start_at,end_at,all_day,location,note,created_at) VALUES (?,?,?,?,?,?,?)`
  );
  const events = [
    ["客户周会 · 过一遍 Q4 方案", wd(0, 9, 30), wd(0, 10, 30), 0, "线上", ""],
    ["写周报", wd(0, 11), wd(0, 12), 0, "内部", ""],
    ["拍摄：个人工作台短视频", wd(3, 14), wd(3, 15), 0, "自媒体", "脚本已就绪"],
    ["读《研究设计》第 4 章", wd(4, 16, 30), wd(4, 17, 30), 0, "研究生", ""],
  ];
  for (const e of events) insertEvent.run(...e, day(-2, 10));

  const insertNote = db.prepare(
    `INSERT INTO note (title,content,source,pinned,created_at,updated_at) VALUES (?,?,?,?,?,?)`
  );
  insertNote.run(
    "选题：把工作台做成「人生 OS」的入口",
    "入口应该是「今天」：打开就知道现在该做什么，做完能记一笔，周末能回头看见自己走了多远。",
    "灵感",
    1,
    day(-1, 9, 12),
    day(-1, 9, 12)
  );
  insertNote.run(
    "客户 A 关心预算，下次带两个方案",
    "保守版：两周试点；完整版：一次交付、可分期。",
    "工作",
    0,
    day(-1, 18, 40),
    day(-1, 18, 40)
  );
  insertNote.run(
    "论文变量再确认：中介效应",
    "自变量工作自主性；中介心理所有权；因变量创新行为。",
    "学习",
    0,
    day(-2, 10, 30),
    day(-2, 10, 30)
  );

  const defaults: Record<string, string> = {
    ai_base_url: "https://api.deepseek.com",
    ai_model: "deepseek-chat",
    ai_key: "",
    user_name: "Hina",
    workbench_name: "HINA STUDIO",
  };
  const ins = db.prepare("INSERT OR IGNORE INTO setting (key,value) VALUES (?,?)");
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
}

function ensureColumn(db: DatabaseSync, table: string, name: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
}

export function getDb(): DatabaseSync {
  const g = globalThis as GlobalWithDb;
  if (g.__workbenchDb) return g.__workbenchDb;

  const dir = process.env.WORKBENCH_DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "workbench.db");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);

  ensureColumn(db, "task", "project", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "task", "tags", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "note", "tags", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "note", "archived", "INTEGER NOT NULL DEFAULT 0");

  const count = (db.prepare("SELECT COUNT(*) AS n FROM task").get() as { n: number }).n;
  const initialized = (db.prepare("SELECT value FROM setting WHERE key = 'initialized'").get() as { value?: string } | undefined)?.value;
  if (count === 0 && initialized !== "1") seed(db);
  db.prepare("INSERT INTO setting (key, value) VALUES ('initialized', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();

  g.__workbenchDb = db;
  return db;
}

export function nowIso() {
  return formatISO(new Date(), { representation: "complete" });
}

export function getSetting(key: string, fallback = "") {
  const row = getDb().prepare("SELECT value FROM setting WHERE key=?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  getDb().prepare("INSERT INTO setting (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}

export function ensureBackup() {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    if (getSetting("last_backup", "") === today) return;
    const dir = path.join(process.env.WORKBENCH_DATA_DIR || path.join(process.cwd(), "data"), "backups");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `workbench-${today}.db`);
    if (fs.existsSync(file)) fs.rmSync(file);
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".db")).sort().reverse();
    for (const old of files.slice(14)) fs.rmSync(path.join(dir, old));
    setSetting("last_backup", today);
  } catch {
    // 备份失败不影响主流程
  }
}

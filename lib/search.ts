import type { DatabaseSync } from "node:sqlite";
import { rows, type Note, type Task, type EventRow, type Review } from "@/lib/db";

/**
 * 全局搜索的核心逻辑。API 和搜索页共用，避免两处写法不一致。
 *
 * 为什么没用 FTS5：SQLite 自带默认分词器对中文等于没用（按字节切，
 * 「健身房」查不出「今天去健身房」），trigram 分词又只支持 3 个字以上，
 * 「健身」「会议」这种两个字的高频词照样查不到。实测 2000 条数据、
 * LIKE 查询 50 次只要 19ms —— 这个量级上 FTS5 是负收益（还要维护
 * 索引表和触发器）。所以用 LIKE，但把能力补上：
 *
 *   · 空格分开多个词 = 每个词都要命中（AND）
 *   · 搜四类内容：任务、记录、日程、复盘
 *   · 标题命中排在正文命中前面
 */

export type Hit = {
  kind: "task" | "note" | "event" | "review";
  id: number;
  title: string;
  snippet: string;
  at: string;
  score: number;
  /** 任务特有的状态，用来给链接带上正确的筛选 */
  status?: string;
};

function terms(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
}

function allMatch(ws: string[], fields: (string | null | undefined)[]): boolean {
  const hay = fields.map((f) => (f ?? "").toLowerCase()).join("\n");
  return ws.every((w) => hay.includes(w.toLowerCase()));
}

function score(ws: string[], title: string | null | undefined, body: string | null | undefined): number {
  const t = (title ?? "").toLowerCase();
  const b = (body ?? "").toLowerCase();
  let s = 0;
  for (const w of ws) {
    const lw = w.toLowerCase();
    if (t.includes(lw)) s += 10;
    if (t.startsWith(lw)) s += 6;
    if (b.includes(lw)) s += 2;
  }
  return s;
}

export function search(
  db: DatabaseSync,
  q: string,
  opts: { kind?: string; from?: string; to?: string } = {}
): Hit[] {
  const ws = terms(q);
  if (!ws.length) return [];
  const kind = opts.kind || "all";
  const from = opts.from || "";
  const to = opts.to || "";
  const inRange = (d: string) => {
    const day = (d || "").slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  };

  const hits: Hit[] = [];

  if (kind === "all" || kind === "task") {
    for (const t of rows<Task>(db, "SELECT * FROM task")) {
      if (!allMatch(ws, [t.title, t.note, t.tags, t.project])) continue;
      const day = (t.due_date || t.updated_at || "").slice(0, 10);
      if (!inRange(day)) continue;
      hits.push({
        kind: "task",
        id: t.id,
        title: t.title,
        snippet: t.note || (t.status === "done" ? "已完成" : "待办"),
        at: t.updated_at,
        status: t.status,
        score: score(ws, t.title, `${t.note} ${t.tags}`) + (t.status === "done" ? 0 : 1),
      });
    }
  }

  if (kind === "all" || kind === "note") {
    for (const n of rows<Note>(db, "SELECT * FROM note")) {
      if (!allMatch(ws, [n.title, n.content, n.tags, n.source])) continue;
      if (!inRange(n.updated_at)) continue;
      const plain = (n.content || "").replace(/\s+/g, " ").trim();
      hits.push({
        kind: "note",
        id: n.id,
        title: n.title || plain.slice(0, 24) || "无标题",
        snippet: plain.slice(0, 120),
        at: n.updated_at,
        score: score(ws, n.title, n.content) + (n.pinned ? 3 : 0),
      });
    }
  }

  if (kind === "all" || kind === "event") {
    for (const e of rows<EventRow>(db, "SELECT * FROM event")) {
      if (!allMatch(ws, [e.title, e.location, e.note])) continue;
      if (!inRange(e.start_at)) continue;
      hits.push({
        kind: "event",
        id: e.id,
        title: e.title,
        snippet: [e.start_at.slice(0, 16).replace("T", " "), e.location].filter(Boolean).join(" · "),
        at: e.start_at,
        score: score(ws, e.title, `${e.location} ${e.note}`),
      });
    }
  }

  if (kind === "all" || kind === "review") {
    for (const r of rows<Review>(db, "SELECT * FROM review")) {
      if (!allMatch(ws, [r.did, r.stuck, r.tomorrow, r.summary])) continue;
      if (!inRange(r.date)) continue;
      const body = [r.did, r.stuck, r.tomorrow, r.summary].filter((x) => (x ?? "").trim()).join(" · ");
      hits.push({
        kind: "review",
        id: r.id,
        title: `${r.date} ${r.type === "daily" ? "日复盘" : "周复盘"}`,
        snippet: body.slice(0, 120),
        at: r.date,
        score: score(ws, "", body),
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score || (b.at > a.at ? 1 : -1));
}

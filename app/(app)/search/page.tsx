import Link from "next/link";
import { format } from "date-fns";
import { getDb, type Task, type Note } from "@/lib/db";
import TopBar from "@/components/TopBar";

const areaLabel: Record<string, string> = { work: "工作", side: "副业", media: "自媒体", study: "学习", life: "生活" };

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const type = sp.type || "all";
  const from = sp.from || "";
  const to = sp.to || "";
  const db = getDb();

  let tasks: Task[] = [];
  let notes: Note[] = [];
  if (q && (type === "all" || type === "task")) {
    let sql = "SELECT * FROM task WHERE (title LIKE ? OR note LIKE ? OR tags LIKE ? OR project LIKE ?)";
    const args: string[] = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`];
    if (from) { sql += " AND substr(COALESCE(due_date, created_at),1,10) >= ?"; args.push(from); }
    if (to) { sql += " AND substr(COALESCE(due_date, created_at),1,10) <= ?"; args.push(to); }
    sql += " ORDER BY updated_at DESC LIMIT 50";
    tasks = (db.prepare(sql).all(...args) as Task[]).map((r) => ({ ...r }));
  }
  if (q && (type === "all" || type === "note")) {
    let sql = "SELECT * FROM note WHERE (title LIKE ? OR content LIKE ? OR tags LIKE ?)";
    const args: string[] = [`%${q}%`, `%${q}%`, `%${q}%`];
    if (from) { sql += " AND substr(updated_at,1,10) >= ?"; args.push(from); }
    if (to) { sql += " AND substr(updated_at,1,10) <= ?"; args.push(to); }
    sql += " ORDER BY updated_at DESC LIMIT 50";
    notes = (db.prepare(sql).all(...args) as Note[]).map((r) => ({ ...r }));
  }

  const total = tasks.length + notes.length;

  return (
    <>
      <TopBar crumb="搜索" />
      <div className="page-head">
        <div>
          <div className="eyebrow">SEARCH · 全文搜索</div>
          <h1>{q ? `“${q}” 的结果` : "找一件事。"}</h1>
          <p>{q ? `共 ${total} 条（任务 ${tasks.length} · 记录 ${notes.length}）` : "搜索任务与记录，可按类型和时间过滤。"}</p>
        </div>
      </div>

      <form className="search-form" action="/search">
        <input name="q" defaultValue={q} placeholder="关键词…" className="sf-q" />
        <select name="type" defaultValue={type} className="sf-sel">
          <option value="all">全部类型</option>
          <option value="task">任务</option>
          <option value="note">记录</option>
        </select>
        <input type="date" name="from" defaultValue={from} className="sf-date" />
        <span className="sf-sep">至</span>
        <input type="date" name="to" defaultValue={to} className="sf-date" />
        <button className="b1" type="submit">搜索</button>
      </form>

      {!q && (
        <div className="card center-empty" style={{ padding: "54px 20px" }}>
          <b>输入一个关键词开始</b>
          <p>⌘K 也可以随时唤起搜索。</p>
        </div>
      )}

      {q && total === 0 && (
        <div className="card center-empty" style={{ padding: "54px 20px" }}>
          <b>没有找到</b>
          <p>换个词，或把时间范围放宽一点。</p>
        </div>
      )}

      {tasks.length > 0 && (
        <section className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div className="sec-head" style={{ margin: "0 2px 8px" }}><h2>任务</h2><span className="count">{tasks.length}</span></div>
          <div className="task-list">
            {tasks.map((t) => (
              <Link key={t.id} href={`/tasks?focus=${t.id}`} className="task-row" style={{ textDecoration: "none" }}>
                <span className={`tt ${t.status === "done" ? "done" : ""}`}>{t.title}</span>
                <span className="meta">
                  <span>{t.due_date ? format(new Date(t.due_date), "M/d") : "随时"}</span>
                  <span className="cat">{t.project || areaLabel[t.area] || t.area}</span>
                  {t.tags && <span>{t.tags}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section className="card" style={{ padding: 14 }}>
          <div className="sec-head" style={{ margin: "0 2px 8px" }}><h2>记录</h2><span className="count">{notes.length}</span></div>
          {notes.map((n) => (
            <Link key={n.id} href={`/notes?id=${n.id}`} className="search-note">
              <b>{n.title || "(无标题)"}</b>
              <span>{n.source} · {format(new Date(n.updated_at), "yyyy/MM/dd")}{n.tags ? ` · ${n.tags}` : ""}</span>
              <p className="nr-p">{n.content.slice(0, 90)}</p>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getDb } from "@/lib/db";
import { search, type Hit } from "@/lib/search";
import TopBar from "@/components/TopBar";
import SearchDates from "@/components/SearchDates";

export const dynamic = "force-dynamic";

const kindMeta: Record<Hit["kind"], { label: string; href: (h: Hit) => string }> = {
  task: { label: "任务", href: (h) => `/tasks?focus=${h.id}` },
  note: { label: "记录", href: (h) => `/notes?id=${h.id}` },
  event: { label: "日程", href: () => `/calendar` },
  review: { label: "复盘", href: () => `/review` },
};

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

  const hits = q ? search(getDb(), q, { kind: type, from, to }) : [];
  const counts = {
    task: hits.filter((h) => h.kind === "task").length,
    note: hits.filter((h) => h.kind === "note").length,
    event: hits.filter((h) => h.kind === "event").length,
    review: hits.filter((h) => h.kind === "review").length,
  };

  return (
    <>
      <TopBar crumb="搜索" />
      <div className="page-head">
        <div>
          <div className="eyebrow">SEARCH · 全文搜索</div>
          <h1>{q ? `“${q}” 的结果` : "找一件事。"}</h1>
          <p>
            {q
              ? `共 ${hits.length} 条（任务 ${counts.task} · 记录 ${counts.note} · 日程 ${counts.event} · 复盘 ${counts.review}）`
              : "搜索任务、记录、日程和复盘。多个关键词用空格分开，会要求全部命中。"}
          </p>
        </div>
      </div>

      <form className="search-form" action="/search">
        <input name="q" defaultValue={q} placeholder="关键词，空格分隔多个…" className="sf-q" />
        <select name="type" defaultValue={type} className="sf-sel">
          <option value="all">全部类型</option>
          <option value="task">任务</option>
          <option value="note">记录</option>
          <option value="event">日程</option>
          <option value="review">复盘</option>
        </select>
        <SearchDates from={from} to={to} />
        <button className="b1" type="submit">搜索</button>
      </form>

      {!q && (
        <div className="card center-empty" style={{ padding: "54px 20px" }}>
          <b>输入一个关键词开始</b>
          <p>⌘K 也可以随时唤起搜索。</p>
        </div>
      )}

      {q && hits.length === 0 && (
        <div className="card center-empty" style={{ padding: "54px 20px" }}>
          <b>没有找到</b>
          <p>换个词，或把时间范围放宽一点。</p>
        </div>
      )}

      {hits.length > 0 && (
        <section className="card" style={{ padding: 14 }}>
          <div className="sec-head" style={{ margin: "0 2px 8px" }}>
            <h2>结果</h2>
            <span className="count">{hits.length}</span>
          </div>
          {hits.map((h) => {
            const meta = kindMeta[h.kind];
            const when = (() => {
              try {
                return h.at ? format(parseISO(h.at.slice(0, 19)), "yyyy/MM/dd") : "";
              } catch {
                return h.at?.slice(0, 10) ?? "";
              }
            })();
            return (
              <Link key={`${h.kind}-${h.id}`} href={meta.href(h)} className="search-note">
                <b>
                  <span className={`sh-kind k-${h.kind}`}>{meta.label}</span>
                  {h.title}
                </b>
                <span>{when}</span>
                {h.snippet ? <p className="nr-p">{h.snippet}</p> : null}
              </Link>
            );
          })}
        </section>
      )}
    </>
  );
}

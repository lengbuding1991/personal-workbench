"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wand2, Sparkles, ArrowRight } from "lucide-react";
import TopBar from "./TopBar";

type Draft = { title: string; area: "work" | "side" | "media" | "study" | "life"; priority: "high" | "med" | "low"; due_date?: string | null };

const areaLabel: Record<string, string> = { work: "工作", side: "副业", media: "自媒体", study: "学习", life: "生活" };

export default function AiApp({ aiReady, settingsHref, reviewHref }: { aiReady: boolean; settingsHref: string; reviewHref: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState(false);

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parse", text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "拆解失败");
        setDrafts([]);
      } else {
        const list: Draft[] = (data.tasks || []).slice(0, 8);
        setDrafts(list);
        setPicked(list.map(() => true));
        setMsg(list.length ? `拆出 ${list.length} 件，勾选后入库。` : "没拆出任务，再写具体一点。");
      }
    } catch {
      setMsg("网络异常，稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  const add = async () => {
    setAdding(true);
    try {
      for (let i = 0; i < drafts.length; i++) {
        if (!picked[i]) continue;
        const d = drafts[i];
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: d.title,
            area: d.area || "work",
            priority: d.priority || "med",
            due_date: d.due_date || null,
            note: "由 AI 从记录拆解",
          }),
        });
      }
      setMsg("已加入任务。");
      setDrafts([]);
      setText("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  };

  const sample = () => setText("今天客户又改需求，方案要补三个真实案例；周报还没写完；小红书选题攒了一堆没整理；论文第 4 章笔记要补变量表；周末想拍一条工作台视频。");

  return (
    <>
      <TopBar crumb="AI 助手" />
      <div className="page-head">
        <div>
          <div className="eyebrow">ASSISTANT · AI 助手</div>
          <h1>把一团乱，拆成下一步。</h1>
          <p>碎碎念、会议记录、语音转文字，扔进来就能拆成任务。</p>
        </div>
        <div className="right">
          <Link href={reviewHref} className="ghost">生成复盘 <ArrowRight size={11} style={{ verticalAlign: -1 }} /></Link>
        </div>
      </div>

      {!aiReady && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 14, borderColor: "#F6E3C0", background: "#FDF8EC" }}>
          <span style={{ fontSize: 11, color: "#93764A" }}>
            还没有配置 AI Key。去{" "}
            <Link href={settingsHref} style={{ color: "#1F9E9A", textDecoration: "underline" }}>设置</Link>{" "}
            填一个 DeepSeek Key，就能使用拆任务与复盘起稿。
          </span>
        </div>
      )}

      <div className="review-grid">
        <section className="card review-card">
          <h2>碎碎念 → 任务</h2>
          <p className="sub">写清楚「要做什么」，AI 会拆成可执行的小步；不确定的它会标成工作。</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="比如：这周要把客户方案补完、录一条视频、整理小红书选题、补论文笔记……"
            style={{ width: "100%", minHeight: 130, background: "#F8FBFE", border: "1px solid #E6EFF8", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.8, resize: "vertical", outline: "none" }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <button className="b1" onClick={parse} disabled={loading}>
              <Wand2 size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              {loading ? "拆解中…" : "拆成任务"}
            </button>
            <button className="b2" onClick={sample}>填个示例</button>
            {msg && <span className="hint2">{msg}</span>}
          </div>

          {drafts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="cmd-group" style={{ paddingLeft: 0 }}>拆解结果</div>
              {drafts.map((d, i) => (
                <label key={i} className="task-row" style={{ marginTop: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={picked[i]}
                    onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))}
                    style={{ accentColor: "#3AC8C2" }}
                  />
                  <span className="tt">{d.title}</span>
                  <span className="meta">
                    <span className="cat">{areaLabel[d.area] || "工作"}</span>
                    {d.priority === "high" && <span style={{ color: "#D2795C" }}>要紧</span>}
                    {d.due_date && <span>{d.due_date}</span>}
                  </span>
                </label>
              ))}
              <div className="acts" style={{ justifyContent: "flex-start" }}>
                <button className="b1" onClick={add} disabled={adding}>{adding ? "入库中…" : "加入任务"}</button>
                <button className="b2" onClick={() => setDrafts([])}>放弃这批</button>
              </div>
            </div>
          )}
        </section>

        <section className="card history">
          <h3>怎么用得更顺</h3>
          <p className="hint2" style={{ marginBottom: 10 }}>AI 只是起稿，确认后才入库。</p>
          <div className="item"><b>01 · 写具体动作</b><p>「补客户方案」比「搞客户」更容易拆；一句话一件事。</p></div>
          <div className="item"><b>02 · 先勾选再入库</b><p>拆多了不怕，只留今天真正要做的几件。</p></div>
          <div className="item"><b>03 · 复盘也能起稿</b><p>AI 会读今天的任务与记录，写一版，你再改。</p></div>
          <div className="item" style={{ borderBottom: 0 }}>
            <b>04 · Key 只存本地</b>
            <p>Key 存在本地 SQLite，只在服务端调用，不会出现在浏览器里。</p>
          </div>
        </section>
      </div>
    </>
  );
}

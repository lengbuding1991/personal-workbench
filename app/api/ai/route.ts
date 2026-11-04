import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/ai";
import { getSetting } from "@/lib/db";
import { getDb } from "@/lib/db";
import { addDays, format, startOfWeek } from "date-fns";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["parse", "review", "test"]),
  text: z.string().max(8000).optional().default(""),
  date: z.string().optional(),
  type: z.enum(["daily", "weekly"]).optional().default("daily"),
});

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate) return gate;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const { action, text, type } = parsed.data;

  try {
    if (action === "test") {
      const base = (getSetting("ai_base_url", "https://api.deepseek.com") || "").replace(/\/+$/, "");
      const key = getSetting("ai_key", "");
      const model = getSetting("ai_model", "deepseek-chat") || "deepseek-chat";
      if (!key) return NextResponse.json({ error: "还没有配置 AI Key" }, { status: 400 });

      // 先试 /models（不花 token）；有些免费服务商没这个接口，404 就退回
      // 发一条极短的对话来验证 Key 和模型名，免得它们看起来像「连接失败」。
      let res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
      if (res.status === 404) {
        res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
        });
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        let hint = `连接失败（HTTP ${res.status}）`;
        if (res.status === 401 || res.status === 403) hint = "Key 无效或已失效（401）。检查有没有复制完整、末尾有没有多余空格。";
        else if (res.status === 404)
          hint = "Base URL 不对（404）。DeepSeek 填 https://api.deepseek.com，智谱填 https://open.bigmodel.cn/api/paas/v4，Ollama 填 http://127.0.0.1:11434/v1。";
        else if (res.status === 402) hint = "账户余额不足（402），去平台充值后再试。";
        else if (res.status === 429) hint = "调用太频繁（429）。免费额度一般有速率限制，过一会儿再试。";
        else if (/model/i.test(detail)) hint = `模型名可能不对（HTTP ${res.status}）。检查有没有拼错，比如 glm-4-flash。`;
        return NextResponse.json({ error: hint }, { status: 502 });
      }
      const data = res.headers.get("content-type")?.includes("json") ? await res.json().catch(() => ({})) : {};
      return NextResponse.json({ ok: true, models: (data?.data || []).slice(0, 8).map((m: { id: string }) => m.id) });
    }
    if (action === "parse") {
      if (!text.trim()) return NextResponse.json({ error: "先写点东西再拆。" }, { status: 400 });
      const out = await chatJson(
        `你是个人工作台的任务整理助手。把用户的一段碎碎念拆成可执行任务。只输出 JSON，格式：
{"tasks":[{"title":"动词开头的短句","area":"work|side|media|study|life","priority":"high|med|low","due_date":"YYYY-MM-DD 或 null"}]}
规则：最多 8 条；标题不超过 24 个汉字；不要合并不同的事；不要编造日期；不确定 area 用 work。`,
        text
      );
      return NextResponse.json(out);
    }

    const db = getDb();
    if (type === "weekly") {
      const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
      const from = format(ws, "yyyy-MM-dd");
      const to = format(addDays(ws, 6), "yyyy-MM-dd");
      const done = db
        .prepare(
          "SELECT title, area, done_at FROM task WHERE status='done' AND done_at >= ? AND done_at < ? ORDER BY done_at"
        )
        .all(from, to);
      const openStuck = db
        .prepare("SELECT title, area, due_date FROM task WHERE status!='done' AND due_date IS NOT NULL AND due_date < ? ORDER BY due_date LIMIT 12")
        .all(to);
      const notes = db
        .prepare("SELECT title, content FROM note WHERE created_at >= ? AND created_at < ? ORDER BY created_at")
        .all(from, to);
      const dailies = db
        .prepare("SELECT date, did, stuck, tomorrow FROM review WHERE type='daily' AND date >= ? AND date <= ? ORDER BY date")
        .all(from, to);
      const out = await chatJson(
        `你是个人复盘助手。根据这一周的任务、记录和日复盘，帮用户写周复盘。只输出 JSON：
{"did":"这周做成了什么，2-3 句","stuck":"这周卡在哪里，1-2 句，允许写暂时没有","tomorrow":"下周最重要的一件事，1 句"}
用第一人称，具体、克制，不要空话，不要编造未出现的事实。`,
        JSON.stringify({ week: `${from} ~ ${to}`, done, overdue: openStuck, notes, dailies })
      );
      return NextResponse.json(out);
    }

    const tasks = db.prepare("SELECT title,status,area,done_at FROM task ORDER BY updated_at DESC LIMIT 40").all();
    const notes = db.prepare("SELECT title,content,updated_at FROM note ORDER BY updated_at DESC LIMIT 8").all();
    const out = await chatJson(
      `你是个人复盘助手。根据任务与记录，帮用户写今日复盘。只输出 JSON：
{"did":"今天做成了什么，2-3 句","stuck":"卡在哪里，1-2 句，允许写暂时没有","tomorrow":"明天最重要的一件事，1 句"}
用第一人称，具体、克制，不要空话，不要编造未出现的事实。`,
      JSON.stringify({ tasks, notes })
    );
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 调用失败";
    if (msg === "NO_KEY") return NextResponse.json({ error: "还没有配置 AI Key，请到设置里填写。" }, { status: 400 });
    if (msg.startsWith("AI_")) return NextResponse.json({ error: `AI 服务返回异常：${msg.slice(0, 200)}` }, { status: 502 });
    return NextResponse.json({ error: `AI 调用失败：${msg}` }, { status: 500 });
  }
}

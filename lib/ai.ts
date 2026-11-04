import { getSetting } from "./db";

export type AiConfig = { baseUrl: string; model: string; apiKey: string };

export function getAiConfig(): AiConfig {
  const baseUrl = (getSetting("ai_base_url", "https://api.deepseek.com") || "").replace(/\/+$/, "");
  const model = getSetting("ai_model", "deepseek-chat") || "deepseek-chat";
  const apiKey = getSetting("ai_key", "") || "";
  return { baseUrl, model, apiKey };
}

export function aiReady() {
  return Boolean(getAiConfig().apiKey);
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export async function chatJson(system: string, user: string): Promise<unknown> {
  const { baseUrl, model, apiKey } = getAiConfig();
  if (!apiKey) throw new Error("NO_KEY");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);

  const body = (withJsonMode: boolean) =>
    JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // 部分免费服务商（智谱、硅基流动的一些模型）不认这个参数，会直接 400。
      // 所以先带着试，被拒了再不带重发一次 —— 反正下面本来就要自己抽 JSON。
      ...(withJsonMode ? { response_format: { type: "json_object" } } : {}),
    });

  try {
    let res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: body(true),
      signal: ctrl.signal,
    });

    // 400 多半是「不支持 response_format」，退回普通模式再试一次。
    if (res.status === 400) {
      await res.text().catch(() => "");
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: body(false),
        signal: ctrl.signal,
      });
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`AI_${res.status}:${detail.slice(0, 300)}`);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return JSON.parse(extractJson(content));
  } finally {
    clearTimeout(timer);
  }
}

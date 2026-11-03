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
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
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

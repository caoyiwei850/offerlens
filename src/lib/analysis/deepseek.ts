import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { AnalysisInput } from "./types";

interface DeepSeekOptions {
  apiKey: string;
  fetcher?: typeof fetch;
  thinkingEnabled: boolean;
  timeoutMs: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export async function callDeepSeek(
  input: AnalysisInput,
  {
    apiKey,
    fetcher = fetch,
    thinkingEnabled,
    timeoutMs,
  }: DeepSeekOptions,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
        response_format: { type: "json_object" },
        thinking: { type: thinkingEnabled ? "enabled" : "disabled" },
        ...(thinkingEnabled ? { reasoning_effort: "high" } : {}),
        temperature: 0,
        max_tokens: 3200,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`模型服务暂时不可用（${response.status}）`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("模型没有返回分析结果");
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("分析超时，请稍后重试");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

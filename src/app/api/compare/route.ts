import { callDeepSeek } from "@/lib/analysis/deepseek";
import { compareJobs } from "@/lib/career/compare";
import { compareRequestSchema } from "@/lib/career/types";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function createCompareHandler(
  callModel = (input: Parameters<typeof callDeepSeek>[0]) =>
    callDeepSeek(input, {
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      thinkingEnabled: process.env.DEEPSEEK_THINKING_ENABLED === "true",
      timeoutMs: 60_000,
    }),
) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_INPUT", "请求格式无效");
    }
    const parsed = compareRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "INVALID_INPUT", "请提供一份简历和 2-5 个岗位描述");
    }
    try {
      return Response.json(await compareJobs(parsed.data, callModel), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return errorResponse(502, "INVALID_MODEL_RESPONSE", "AI 未能完成岗位对比，请重试");
    }
  };
}

export function POST(request: Request): Promise<Response> {
  return createCompareHandler()(request);
}

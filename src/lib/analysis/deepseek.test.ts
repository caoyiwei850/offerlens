import { describe, expect, it, vi } from "vitest";

import { callDeepSeek } from "./deepseek";

describe("callDeepSeek", () => {
  it("makes one JSON-mode request to deepseek-v4-flash", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const content = await callDeepSeek(
      { resume: "resume", jd: "jd" },
      {
        apiKey: "test-key",
        fetcher,
        thinkingEnabled: false,
        timeoutMs: 1_000,
      },
    );

    expect(content).toBe('{"ok":true}');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [, init] = fetcher.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "deepseek-v4-flash",
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      stream: false,
    });
  });

  it("rejects an empty model response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ choices: [{ message: { content: "" } }] }),
    );

    await expect(
      callDeepSeek(
        { resume: "resume", jd: "jd" },
        { apiKey: "test-key", fetcher, thinkingEnabled: false, timeoutMs: 1_000 },
      ),
    ).rejects.toThrow("模型没有返回分析结果");
  });
});

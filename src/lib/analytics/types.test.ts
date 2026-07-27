import { describe, expect, it } from "vitest";

import { analyticsEventSchema, analyticsSummaryQuerySchema } from "./types";

const base = {
  eventId: "e".repeat(32),
  sessionId: "s".repeat(32),
};

describe("analytics event contract", () => {
  it("accepts a bounded successful-analysis event", () => {
    expect(
      analyticsEventSchema.parse({
        ...base,
        type: "ANALYSIS_SUCCEEDED",
        dimensions: {
          occupationFamily: "HEALTHCARE_CARE",
          result: "PASS",
          applicationStatus: "READY",
          inputMode: "TEXT",
          durationMs: 12_000,
        },
      }),
    ).toMatchObject({ type: "ANALYSIS_SUCCEEDED" });
  });

  it("rejects resume content and arbitrary metadata", () => {
    expect(
      analyticsEventSchema.safeParse({
        ...base,
        type: "ANALYSIS_STARTED",
        dimensions: {},
        resume: "我的完整简历",
      }).success,
    ).toBe(false);
    expect(
      analyticsEventSchema.safeParse({
        ...base,
        type: "ANALYSIS_FAILED",
        dimensions: { message: "包含用户输入的错误详情" },
      }).success,
    ).toBe(false);
  });

  it("only supports 7 or 30 day summaries", () => {
    expect(analyticsSummaryQuerySchema.parse({ days: "7" })).toEqual({
      days: 7,
    });
    expect(analyticsSummaryQuerySchema.safeParse({ days: "365" }).success).toBe(
      false,
    );
  });
});

// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createFeedbackRepository } from "./repository";

describe("feedback repository", () => {
  it("stores independent feedback and returns private admin records newest first", () => {
    const timestamps = [
      "2026-07-04T01:00:00.000Z",
      "2026-07-04T02:00:00.000Z",
    ];
    const ids = ["feedback-1", "feedback-2"];
    const repository = createFeedbackRepository({
      path: ":memory:",
      createId: () => ids.shift()!,
      now: () => timestamps.shift()!,
    });

    repository.create({
      kind: "PRODUCT_SUGGESTION",
      outcome: null,
      predictionMatch: null,
      rating: 4,
      content: "希望增加独立反馈入口。",
      occupationFamily: null,
      deviceHash: "device-hash",
      ipHash: "ip-hash",
    });
    const created = repository.create({
      kind: "INTERVIEW_OUTCOME",
      outcome: "OFFERED",
      predictionMatch: "MATCHED",
      rating: 5,
      content: "实际面试卡点与模拟一致。",
      occupationFamily: "BUSINESS_COMMERCIAL",
      deviceHash: "device-hash",
      ipHash: "ip-hash",
    });

    expect(created).toEqual({ id: "feedback-2", status: "RECEIVED" });
    expect(repository.listRecent(20)).toEqual([
      expect.objectContaining({
        id: "feedback-2",
        outcome: "OFFERED",
        predictionMatch: "MATCHED",
      }),
      expect.objectContaining({
        id: "feedback-1",
        kind: "PRODUCT_SUGGESTION",
        outcome: null,
      }),
    ]);
    expect(JSON.stringify(repository.listRecent(20))).not.toContain(
      "device-hash",
    );
    repository.close();
  });
});

// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  checkFeedbackAccess,
  type FeedbackRateLimitStore,
} from "./access";

const identity = {
  ip: "203.0.113.10",
  deviceId: "a".repeat(64),
  fingerprint: "b".repeat(64),
};

describe("feedback access", () => {
  it("uses feedback-specific keys and returns only salted hashes", async () => {
    const evaluate = vi.fn<FeedbackRateLimitStore["evaluate"]>(
      async () => [0, 0],
    );
    const result = await checkFeedbackAccess(
      identity,
      "feedback-secret-for-tests",
      { evaluate },
    );

    expect(result).toMatchObject({ allowed: true });
    expect(evaluate.mock.calls[0]?.[0]).toEqual([
      expect.stringMatching(/^offerlens:feedback:ip:/),
      expect.stringMatching(/^offerlens:feedback:device:/),
      expect.stringMatching(/^offerlens:feedback:cooldown:/),
    ]);
    expect(JSON.stringify(result)).not.toContain(identity.ip);
    expect(JSON.stringify(result)).not.toContain(identity.deviceId);
  });

  it("fails closed when Redis is unavailable", async () => {
    await expect(
      checkFeedbackAccess(identity, "feedback-secret-for-tests", {
        evaluate: async () => {
          throw new Error("offline");
        },
      }),
    ).rejects.toThrow("反馈服务暂时不可用");
  });
});

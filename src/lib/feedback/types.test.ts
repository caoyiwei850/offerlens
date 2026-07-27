import { describe, expect, it } from "vitest";

import { feedbackSubmissionSchema } from "./types";

const identity = {
  deviceId: "a".repeat(64),
  fingerprint: "b".repeat(64),
};

describe("feedback submission contract", () => {
  it("requires an outcome and prediction match after a real interview", () => {
    const parsed = feedbackSubmissionSchema.parse({
      kind: "INTERVIEW_OUTCOME",
      outcome: "OFFERED",
      predictionMatch: "PARTLY_MATCHED",
      rating: 5,
      content: "面试官确实重点追问了系统设计，建议很有帮助。",
      occupationFamily: "TECH_DIGITAL",
      ...identity,
    });

    expect(parsed).toMatchObject({
      kind: "INTERVIEW_OUTCOME",
      outcome: "OFFERED",
      predictionMatch: "PARTLY_MATCHED",
    });
  });

  it("accepts a product suggestion without pretending an interview happened", () => {
    expect(
      feedbackSubmissionSchema.parse({
        kind: "PRODUCT_SUGGESTION",
        rating: 4,
        content: "希望增加面试记录整理功能。",
        ...identity,
      }),
    ).toMatchObject({
      kind: "PRODUCT_SUGGESTION",
      outcome: null,
      predictionMatch: null,
    });
  });

  it("rejects interview accuracy claims without an actual outcome", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        kind: "INTERVIEW_OUTCOME",
        rating: 4,
        content: "看起来挺准确。",
        ...identity,
      }).success,
    ).toBe(false);
  });

  it("rejects private material and unknown fields", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        kind: "PRODUCT_SUGGESTION",
        rating: 4,
        content: "页面建议。",
        resume: "完整简历",
        ...identity,
      }).success,
    ).toBe(false);
  });
});

// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createResumePlanHandler } from "./route";
import type { ResumeAccessStore } from "@/lib/resume-workbench/access";
import { analysisFixture, resumeDraft } from "@/test/resume-fixtures";

const deviceId = "a".repeat(64);
const fingerprint = "b".repeat(64);

function accessStore(): ResumeAccessStore {
  return {
    evaluatePlan: vi.fn(async () => [0, 0] as [number, number]),
    saveToken: vi.fn(async () => undefined),
    consumeToken: vi.fn(async () => true),
  };
}

function request(resumeText = "张三\n负责交易系统限流改造") {
  return new Request("http://localhost/api/resume/plan", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `offerlens_device_id=${deviceId}`,
      "x-real-ip": "203.0.113.10",
    },
    body: JSON.stringify({
      resumeText,
      jd: "市场运营专员",
      analysis: analysisFixture,
      deviceId,
      fingerprint,
    }),
  });
}

describe("POST /api/resume/plan", () => {
  it("returns a fact-backed plan and one-time token with one model call", async () => {
    const callModel = vi.fn(async () =>
      JSON.stringify({
        draft: resumeDraft,
        questions: [],
        issues: [],
        recommendedTemplate: "PROFESSIONAL",
      }),
    );
    const store = accessStore();
    const handler = createResumePlanHandler({
      accessStore: store,
      checkAccess: async () => ({ allowed: true }),
      callModel,
    });

    const response = await handler(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.facts).toHaveLength(2);
    expect(body.rewriteToken).toHaveLength(43);
    expect(callModel).toHaveBeenCalledOnce();
    expect(store.saveToken).toHaveBeenCalledOnce();
  });

  it("returns 502 without retrying an invented fact reference", async () => {
    const callModel = vi.fn(async () =>
      JSON.stringify({
        draft: {
          ...resumeDraft,
          experiences: [
            {
              ...resumeDraft.experiences[0],
              bullets: [
                {
                  ...resumeDraft.experiences[0].bullets[0],
                  factRefs: ["invented"],
                },
              ],
            },
          ],
        },
        questions: [],
        issues: [],
        recommendedTemplate: "PROFESSIONAL",
      }),
    );
    const handler = createResumePlanHandler({
      accessStore: accessStore(),
      checkAccess: async () => ({ allowed: true }),
      callModel,
    });

    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(callModel).toHaveBeenCalledOnce();
  });

  it("normalizes a non-standard all-career experience type before validation", async () => {
    const callModel = vi.fn(async () =>
      JSON.stringify({
        draft: {
          ...resumeDraft,
          experiences: resumeDraft.experiences.map((experience) => ({
            ...experience,
            type: "自由职业",
          })),
        },
        questions: [],
        issues: [],
        recommendedTemplate: "EXPERIENCE",
      }),
    );
    const handler = createResumePlanHandler({
      accessStore: accessStore(),
      checkAccess: async () => ({ allowed: true }),
      callModel,
    });

    const response = await handler(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: { experiences: [{ type: "FREELANCE" }] },
    });
  });

  it("explains which resume planning limit was hit", async () => {
    const handler = createResumePlanHandler({
      accessStore: accessStore(),
      checkAccess: async () => ({
        allowed: false,
        reason: "device",
        retryAfter: 3600,
      }),
      callModel: async () => {
        throw new Error("should not call model");
      },
    });

    const response = await handler(request());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "RATE_LIMITED",
        message: "今天这台设备的简历规划次数已用完",
        retryAfter: 3600,
      },
    });
  });

  it("adds a required plain-language question for every timeline conflict", async () => {
    const callModel = vi.fn(async () =>
      JSON.stringify({
        draft: {
          ...resumeDraft,
          experiences: [],
        },
        questions: [],
        issues: [],
        recommendedTemplate: "CAMPUS",
      }),
    );
    const handler = createResumePlanHandler({
      accessStore: accessStore(),
      checkAccess: async () => ({ allowed: true }),
      callModel,
    });
    const response = await handler(
      request(`张三 23岁 大学本科
大学刚毕业
深圳市蓝海优品科技有限公司 电商运营主管 2021.04 — 至今
武汉市锦程电子商务有限公司 电商运营专员 2019.08 — 2021.03`),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.issues.length).toBeGreaterThanOrEqual(3);
    for (const issue of body.issues) {
      const question = body.questions.find(
        (candidate: { issueIds: string[] }) =>
          candidate.issueIds.includes(issue.id),
      );
      expect(question).toMatchObject({
        required: true,
        answerMode: "DIRECT_CONFIRMATION",
      });
      expect(question.possibleSources.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createAnalyzeHandler } from "./route";
import type {
  HiringSimulation,
  ModelHiringSimulation,
} from "@/lib/analysis/types";
import {
  evaluationContext,
  evidenceAssessment,
} from "@/test/hiring-fixtures";
import type { OccupationCorrectionStore } from "@/lib/analysis/correction";

const deviceId = "a".repeat(64);
const fingerprint = "b".repeat(64);
const modelSimulation = {
  evaluation_context: evaluationContext,
  flow: [
    { stage: "材料初筛", status: "PASS", reason: "岗位关键信息覆盖充分。" },
    { stage: "硬性条件核验", status: "PASS", reason: "学历与年限满足岗位要求。" },
    { stage: "岗位能力匹配", status: "FAIL", reason: "缺少策略规划经验，无法证明可承接该岗位核心职责。" },
    { stage: "经历证据评估", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
    { stage: "面试决策", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
  ],
  bottleneck_stage: "岗位能力匹配",
  bottleneck_reason: "缺少策略规划经验，无法证明可承接该岗位核心职责。",
  final_result: "REJECT",
  improvements: [
    "补充 1–2 个含 QPS、数据规模和取舍的项目案例",
    "针对岗位描述的策略要求补充方案准备",
    "在简历中明确策略选择和执行依据",
  ],
  evidence_assessment: evidenceAssessment,
} satisfies ModelHiringSimulation;

const validSimulation = {
  ...modelSimulation,
  passed_stage_count: 2,
  application_status: "REVISE_AND_APPLY",
} satisfies HiringSimulation;

function makeRequest(
  overrides: {
    cookie?: string;
    jd?: string;
    occupationFamily?: string;
    correctionToken?: string;
  } = {},
) {
  const form = new FormData();
  form.set("resumeText", "三年市场运营经验");
  form.set("jd", overrides.jd ?? "负责用户增长和市场策略的设计和交付");
  form.set("deviceId", deviceId);
  form.set("fingerprint", fingerprint);
  if (overrides.occupationFamily) {
    form.set("occupationFamily", overrides.occupationFamily);
  }
  if (overrides.correctionToken) {
    form.set("correctionToken", overrides.correctionToken);
  }

  return new Request("http://localhost/api/analyze", {
    method: "POST",
    body: form,
    headers: {
      cookie: overrides.cookie ?? `offerlens_device_id=${deviceId}`,
      "x-real-ip": "203.0.113.10",
    },
  });
}

function correctionStore(): OccupationCorrectionStore {
  return {
    saveToken: vi.fn(async () => undefined),
    claimToken: vi.fn(async () => true),
    completeToken: vi.fn(async () => true),
    releaseToken: vi.fn(async () => undefined),
  };
}

describe("POST /api/analyze", () => {
  it("returns the exact HiringSimulation contract", async () => {
    const callModel = vi.fn(async () => JSON.stringify(modelSimulation));
    const handler = createAnalyzeHandler({
      callModel,
      checkAccess: async () => ({ allowed: true }),
      checkCorrectionAccess: async () => ({ allowed: true }),
      correctionStore: correctionStore(),
    });

    const response = await handler(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ...validSimulation,
      correction: {
        token: expect.any(String),
        expires_at: expect.any(String),
      },
    });
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("rejects a device id that does not match the cookie", async () => {
    const callModel = vi.fn(async () => JSON.stringify(modelSimulation));
    const handler = createAnalyzeHandler({
      callModel,
      checkAccess: async () => ({ allowed: true }),
      checkCorrectionAccess: async () => ({ allowed: true }),
      correctionStore: correctionStore(),
    });

    const response = await handler(makeRequest({ cookie: "offerlens_device_id=wrong" }));

    expect(response.status).toBe(400);
    expect(callModel).not.toHaveBeenCalled();
  });

  it("returns retry information when access is limited", async () => {
    const handler = createAnalyzeHandler({
      callModel: async () => JSON.stringify(modelSimulation),
      checkAccess: async () => ({
        allowed: false,
        reason: "device",
        retryAfter: 120,
      }),
      checkCorrectionAccess: async () => ({ allowed: true }),
      correctionStore: correctionStore(),
    });

    const response = await handler(makeRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED", retryAfter: 120 },
    });
  });

  it("does not retry an invalid model response", async () => {
    const callModel = vi.fn(async () => "not json");
    const handler = createAnalyzeHandler({
      callModel,
      checkAccess: async () => ({ allowed: true }),
      checkCorrectionAccess: async () => ({ allowed: true }),
      correctionStore: correctionStore(),
    });

    const response = await handler(makeRequest());

    expect(response.status).toBe(502);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("returns 502 without retrying a logically inconsistent simulation", async () => {
    const inconsistent = {
      ...modelSimulation,
      bottleneck_stage: "经历证据评估",
    };
    const callModel = vi.fn(async () => JSON.stringify(inconsistent));
    const handler = createAnalyzeHandler({
      callModel,
      checkAccess: async () => ({ allowed: true }),
      checkCorrectionAccess: async () => ({ allowed: true }),
      correctionStore: correctionStore(),
    });

    const response = await handler(makeRequest());

    expect(response.status).toBe(502);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("honors a manual occupation selection without creating a correction token", async () => {
    const callModel = vi.fn(async () =>
      JSON.stringify({
        ...modelSimulation,
        evaluation_context: {
          ...evaluationContext,
          occupation_family: "HEALTHCARE_CARE",
          occupation_name: "养老护理员",
        },
      }),
    );
    const handler = createAnalyzeHandler({
      callModel,
      checkAccess: async () => ({ allowed: true }),
      checkCorrectionAccess: async () => ({ allowed: true }),
      correctionStore: correctionStore(),
    });

    const response = await handler(
      makeRequest({ occupationFamily: "HEALTHCARE_CARE" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      evaluation_context: {
        occupation_family: "HEALTHCARE_CARE",
        occupation_source: "USER_OVERRIDE",
      },
      correction: null,
    });
  });

  it("uses a valid correction token without charging the device daily limiter", async () => {
    const store = correctionStore();
    const checkAccess = vi.fn(async () => ({ allowed: true } as const));
    const checkCorrectionAccess = vi.fn(
      async () => ({ allowed: true } as const),
    );
    const callModel = vi.fn(async () =>
      JSON.stringify({
        ...modelSimulation,
        evaluation_context: {
          ...evaluationContext,
          occupation_family: "HEALTHCARE_CARE",
          occupation_name: "养老护理员",
        },
      }),
    );
    const handler = createAnalyzeHandler({
      callModel,
      checkAccess,
      checkCorrectionAccess,
      correctionStore: store,
    });

    const response = await handler(
      makeRequest({
        occupationFamily: "HEALTHCARE_CARE",
        correctionToken: "c".repeat(32),
      }),
    );

    expect(response.status).toBe(200);
    expect(checkAccess).not.toHaveBeenCalled();
    expect(checkCorrectionAccess).toHaveBeenCalledOnce();
    expect(store.claimToken).toHaveBeenCalledOnce();
    expect(store.completeToken).toHaveBeenCalledOnce();
  });

  it("releases a claimed correction token when the model fails", async () => {
    const store = correctionStore();
    const handler = createAnalyzeHandler({
      callModel: async () => "not json",
      checkAccess: async () => ({ allowed: true }),
      checkCorrectionAccess: async () => ({ allowed: true }),
      correctionStore: store,
    });

    const response = await handler(
      makeRequest({
        occupationFamily: "HEALTHCARE_CARE",
        correctionToken: "c".repeat(32),
      }),
    );
    expect(response.status).toBe(502);
    expect(store.releaseToken).toHaveBeenCalledOnce();
  });
});

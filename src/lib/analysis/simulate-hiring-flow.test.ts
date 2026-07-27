import { describe, expect, it } from "vitest";

import { simulateHiringFlow } from "./simulate-hiring-flow";
import type { HiringSimulation, ModelHiringSimulation } from "./types";
import {
  evaluationContext,
  evidenceAssessment,
} from "@/test/hiring-fixtures";
import { OCCUPATION_FAMILIES } from "./occupation";

const modelSimulation = {
  evaluation_context: evaluationContext,
  flow: [
    { stage: "材料初筛", status: "PASS", reason: "关键信息覆盖充分。" },
    { stage: "硬性条件核验", status: "PASS", reason: "硬性条件符合要求。" },
    { stage: "岗位能力匹配", status: "FAIL", reason: "策略规划证据不足。" },
    { stage: "经历证据评估", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
    { stage: "面试决策", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
  ],
  bottleneck_stage: "岗位能力匹配",
  bottleneck_reason: "策略规划证据不足。",
  final_result: "REJECT",
  improvements: ["补充策略案例", "量化项目成果", "准备项目复盘"],
  evidence_assessment: evidenceAssessment,
} satisfies ModelHiringSimulation;

const expectedSimulation = {
  ...modelSimulation,
  passed_stage_count: 2,
  application_status: "REVISE_AND_APPLY",
} satisfies HiringSimulation;

describe("simulateHiringFlow", () => {
  it.each(OCCUPATION_FAMILIES)(
    "accepts a coherent result for occupation family %s",
    async (occupationFamily) => {
      const result = await simulateHiringFlow(
        { resume: "包含与岗位相关的真实经历。", jd: "目标岗位描述。" },
        async () =>
          JSON.stringify({
            ...modelSimulation,
            evaluation_context: {
              ...modelSimulation.evaluation_context,
              occupation_family: occupationFamily,
              occupation_name: "目标岗位",
            },
          }),
      );
      expect(result.evaluation_context.occupation_family).toBe(occupationFamily);
    },
  );

  it("derives progress and application status from one strictly validated model call", async () => {
    const result = await simulateHiringFlow(
      { resume: "三年市场运营经验", jd: "负责用户增长和市场策略" },
      async () => JSON.stringify(modelSimulation),
    );

    expect(result).toEqual(expectedSimulation);
  });

  it("keeps all five evidence dimensions when the real flow stops at stage one", async () => {
    const firstStageFailure: ModelHiringSimulation = {
      ...modelSimulation,
      flow: modelSimulation.flow.map((step, index) => ({
        ...step,
        status: index === 0 ? "FAIL" : "SKIPPED",
        reason:
          index === 0
            ? "岗位关键信息覆盖不足。"
            : "因前序阶段未通过，未进入本阶段。",
      })),
      bottleneck_stage: "材料初筛",
      bottleneck_reason: "岗位关键信息覆盖不足。",
    };

    const result = await simulateHiringFlow(
      { resume: "三年市场运营经验", jd: "负责用户增长和市场策略" },
      async () => JSON.stringify(firstStageFailure),
    );

    expect(result.flow.slice(1).every((step) => step.status === "SKIPPED")).toBe(true);
    expect(Object.keys(result.evidence_assessment.dimensions)).toHaveLength(5);
    expect(result.passed_stage_count).toBe(0);
    expect(result.application_status).toBe("HOLD");
  });

  it("enforces a user-selected occupation family and records its source", async () => {
    const result = await simulateHiringFlow(
      {
        resume: "三年养老护理经历",
        jd: "养老护理员",
        occupationOverride: "HEALTHCARE_CARE",
      },
      async () =>
        JSON.stringify({
          ...modelSimulation,
          evaluation_context: {
            ...modelSimulation.evaluation_context,
            occupation_family: "HEALTHCARE_CARE",
            occupation_name: "养老护理员",
            occupation_source: "AUTO",
          },
        }),
    );

    expect(result.evaluation_context.occupation_family).toBe("HEALTHCARE_CARE");
    expect(result.evaluation_context.occupation_source).toBe("USER_OVERRIDE");
  });

  it("rejects a model that ignores a user-selected occupation family", async () => {
    await expect(
      simulateHiringFlow(
        {
          resume: "三年养老护理经历",
          jd: "养老护理员",
          occupationOverride: "HEALTHCARE_CARE",
        },
        async () => JSON.stringify(modelSimulation),
      ),
    ).rejects.toThrow("职业领域");
  });

  it("rejects extra numeric scoring fields without calling the model again", async () => {
    let calls = 0;
    await expect(
      simulateHiringFlow(
        { resume: "三年市场运营经验", jd: "负责用户增长和市场策略" },
        async () => {
          calls += 1;
          return JSON.stringify({ ...modelSimulation, score: 80 });
        },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("rejects non-JSON model output without calling the model again", async () => {
    let calls = 0;
    await expect(
      simulateHiringFlow(
        { resume: "三年市场运营经验", jd: "负责用户增长和市场策略" },
        async () => {
          calls += 1;
          return "这是额外说明";
        },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

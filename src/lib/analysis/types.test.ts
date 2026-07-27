import { describe, expect, it } from "vitest";

import { deriveApplicationOutcome } from "./evidence";
import { hiringSimulationSchema } from "./types";
import { evidenceAssessment } from "@/test/hiring-fixtures";

const stages = [
  "材料初筛",
  "硬性条件核验",
  "岗位能力匹配",
  "经历证据评估",
  "面试决策",
] as const;

const evaluationContext = {
  candidate_type: "FRESH_GRADUATE",
  job_track: "CAMPUS",
  occupation_family: "EDUCATION_RESEARCH",
  occupation_name: "中学教师",
  occupation_source: "AUTO",
  basis: "简历显示为当年毕业生，岗位描述面向应届生且无全职年限要求。",
} as const;

function rejectedAt(failedIndex: number) {
  const flow = stages.map((stage, index) => ({
    stage,
    status: (
      index < failedIndex ? "PASS" : index === failedIndex ? "FAIL" : "SKIPPED"
    ) as "PASS" | "FAIL" | "SKIPPED",
    reason:
      index < failedIndex
        ? `${stage}通过。`
        : index === failedIndex
          ? `${stage}未通过。`
          : "因前序阶段未通过，未进入本阶段。",
  }));
  return {
    evaluation_context: evaluationContext,
    flow,
    bottleneck_stage: stages[failedIndex],
    bottleneck_reason: `${stages[failedIndex]}未通过。`,
    final_result: "REJECT",
    improvements: ["补充岗位证据", "量化项目成果", "准备针对性案例"],
    evidence_assessment: evidenceAssessment,
    ...deriveApplicationOutcome(flow, evidenceAssessment),
  };
}

const passedFlow = stages.map((stage) => ({
  stage,
  status: "PASS" as const,
  reason: `${stage}通过。`,
}));
const passedSimulation = {
  evaluation_context: evaluationContext,
  flow: passedFlow,
  bottleneck_stage: "",
  bottleneck_reason: "",
  final_result: "PASS",
  improvements: ["补充岗位证据", "量化项目成果", "准备针对性案例"],
  evidence_assessment: evidenceAssessment,
  ...deriveApplicationOutcome(passedFlow, evidenceAssessment),
};

describe("hiringSimulationSchema", () => {
  it.each([0, 1, 2, 3, 4])("accepts a coherent rejection at stage %s", (failedIndex) => {
    expect(hiringSimulationSchema.safeParse(rejectedAt(failedIndex)).success).toBe(true);
  });

  it("accepts an honest all-pass path", () => {
    expect(hiringSimulationSchema.safeParse(passedSimulation).success).toBe(true);
  });

  it("rejects a simulation without an explicit evaluation context", () => {
    const withoutContext = { ...rejectedAt(0) };
    Reflect.deleteProperty(withoutContext, "evaluation_context");
    expect(hiringSimulationSchema.safeParse(withoutContext).success).toBe(false);
  });

  it("rejects model-controlled flow progress or application status", () => {
    expect(
      hiringSimulationSchema.safeParse({
        ...rejectedAt(2),
        passed_stage_count: 5,
      }).success,
    ).toBe(false);
    expect(
      hiringSimulationSchema.safeParse({
        ...rejectedAt(2),
        application_status: "STRETCH",
      }).success,
    ).toBe(false);
  });

  it("rejects a dimension without an actionable suggestion", () => {
    const value = structuredClone(rejectedAt(0));
    value.evidence_assessment.dimensions.basicQualification.suggestion = "无。";
    expect(hiringSimulationSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    [
      "stage order changes",
      () => {
        const value = rejectedAt(2);
        [value.flow[0], value.flow[1]] = [value.flow[1], value.flow[0]];
        return value;
      },
    ],
    [
      "multiple stages fail",
      () => {
        const value = rejectedAt(2);
        value.flow[3].status = "FAIL";
        return value;
      },
    ],
    [
      "a stage is skipped before the failure",
      () => {
        const value = rejectedAt(2);
        value.flow[1].status = "SKIPPED";
        return value;
      },
    ],
    [
      "the bottleneck does not match the first failure",
      () => ({ ...rejectedAt(2), bottleneck_stage: "经历证据评估" }),
    ],
    [
      "a rejected path claims PASS",
      () => ({ ...rejectedAt(2), final_result: "PASS" }),
    ],
    [
      "an all-pass path contains a bottleneck",
      () => ({
        ...passedSimulation,
        bottleneck_stage: "岗位能力匹配",
        bottleneck_reason: "不应存在的卡点",
      }),
    ],
  ])("rejects a logically inconsistent simulation when %s", (_label, makeValue) => {
    expect(hiringSimulationSchema.safeParse(makeValue()).success).toBe(false);
  });
});

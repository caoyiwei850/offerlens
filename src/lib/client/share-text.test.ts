import { describe, expect, it } from "vitest";

import type { HiringSimulation } from "@/lib/analysis/types";
import { buildShareText } from "./share-text";
import { evaluationContext, evidenceAssessment } from "@/test/hiring-fixtures";

const rejectedSimulation: HiringSimulation = {
  evaluation_context: evaluationContext,
  flow: [
    { stage: "材料初筛", status: "PASS", reason: "关键词通过。" },
    { stage: "硬性条件核验", status: "PASS", reason: "基础条件通过。" },
    { stage: "岗位能力匹配", status: "FAIL", reason: "策略规划证据不足。" },
    { stage: "经历证据评估", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
    { stage: "面试决策", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
  ],
  bottleneck_stage: "岗位能力匹配",
  bottleneck_reason: "策略规划证据不足。",
  final_result: "REJECT",
  improvements: ["补充策略案例", "量化项目成果", "准备项目复盘"],
  evidence_assessment: evidenceAssessment,
  passed_stage_count: 2,
  application_status: "REVISE_AND_APPLY",
};

describe("buildShareText", () => {
  it("includes the bottleneck and a return link", () => {
    const text = buildShareText(rejectedSimulation, "https://offerlens.example");

    expect(text).toContain("我卡在「岗位能力匹配」");
    expect(text).toContain("策略规划证据不足。");
    expect(text).toContain("已通过 2/5 个招聘阶段");
    expect(text).toContain("投递建议：补充后可投");
    expect(text).toContain("https://offerlens.example");
  });

  it("does not invent a bottleneck for an all-pass result", () => {
    const text = buildShareText(
      {
        ...rejectedSimulation,
        flow: rejectedSimulation.flow.map((step) => ({
          ...step,
          status: "PASS",
          reason: `${step.stage}通过。`,
        })),
        bottleneck_stage: "",
        bottleneck_reason: "",
        final_result: "PASS",
        passed_stage_count: 5,
        application_status: "READY",
      },
      "https://offerlens.example",
    );

    expect(text).toContain("模拟筛选已通过，可以准备面试了");
    expect(text).toContain("已通过 5/5 个招聘阶段");
    expect(text).toContain("投递建议：可以投递");
    expect(text).not.toContain("我卡在");
    expect(text).toContain("https://offerlens.example");
  });
});

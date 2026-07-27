import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShareCard } from "./share-card";
import type { HiringSimulation } from "@/lib/analysis/types";
import { evaluationContext, evidenceAssessment } from "@/test/hiring-fixtures";

const simulation = {
  evaluation_context: evaluationContext,
  flow: [
    { stage: "材料初筛", status: "PASS", reason: "关键词覆盖充分，命中 JD 核心技术栈。" },
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
  passed_stage_count: 2,
  application_status: "REVISE_AND_APPLY",
} satisfies HiringSimulation;

describe("ShareCard", () => {
  it("contains only a share-safe bottleneck summary", () => {
    render(<ShareCard simulation={simulation} />);

    // 卡点阶段与原因（脱敏摘要）
    expect(screen.getByText(/岗位能力匹配/)).toBeInTheDocument();
    expect(
      screen.getByText("缺少策略规划经验，无法证明可承接该岗位核心职责。"),
    ).toBeInTheDocument();

    // 不泄露简历原文
    expect(screen.queryByText("三年市场运营经验")).not.toBeInTheDocument();

    // 脱敏说明
    expect(screen.getByText("未包含姓名、简历或完整岗位描述")).toBeInTheDocument();
    expect(screen.getByText("已通过 2/5 个招聘阶段")).toBeInTheDocument();
    expect(screen.getByText("投递建议：补充后可投")).toBeInTheDocument();
  });

  it("renders an honest all-pass card without a bottleneck reason", () => {
    const passedSimulation: HiringSimulation = {
      evaluation_context: evaluationContext,
      flow: simulation.flow.map((step) => ({
        ...step,
        status: "PASS",
        reason: `${step.stage}通过。`,
      })),
      bottleneck_stage: "",
      bottleneck_reason: "",
      final_result: "PASS",
      improvements: simulation.improvements,
      evidence_assessment: evidenceAssessment,
      passed_stage_count: 5,
      application_status: "READY",
    };

    render(<ShareCard simulation={passedSimulation} />);

    expect(screen.getByText("可以准备面试了")).toBeInTheDocument();
    expect(screen.getByText("已通过 5/5 个招聘阶段")).toBeInTheDocument();
    expect(screen.getByText("投递建议：可以投递")).toBeInTheDocument();
    expect(screen.queryByText("BOTTLENECK REASON")).not.toBeInTheDocument();
  });
});

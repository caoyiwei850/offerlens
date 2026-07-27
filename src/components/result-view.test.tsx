import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultView } from "./result-view";
import type { HiringSimulation } from "@/lib/analysis/types";
import {
  evaluationContext,
  evidenceAssessment,
} from "@/test/hiring-fixtures";

const simulation = {
  evaluation_context: {
    ...evaluationContext,
    candidate_type: "FRESH_GRADUATE",
    job_track: "CAMPUS",
    basis: "简历显示为应届毕业生，岗位面向校招且未要求全职年限。",
  },
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
  passed_stage_count: 2,
  application_status: "REVISE_AND_APPLY",
} satisfies HiringSimulation;

describe("ResultView", () => {
  it("shows the hiring flow stages, bottleneck, and improvements", () => {
    render(<ResultView simulation={simulation} />);

    // 五个流程阶段
    expect(screen.getByText("材料初筛")).toBeInTheDocument();
    expect(screen.getByText("硬性条件核验")).toBeInTheDocument();
    expect(screen.getAllByText("岗位能力匹配").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("经历证据评估")).toBeInTheDocument();
    expect(screen.getByText("面试决策")).toBeInTheDocument();

    // 卡点
    expect(screen.getByText(/你被淘汰在：岗位能力匹配/)).toBeInTheDocument();
    expect(
      screen.getAllByText("缺少策略规划经验，无法证明可承接该岗位核心职责。").length,
    ).toBeGreaterThanOrEqual(1);

    // 优化建议
    expect(
      screen.getByText("在简历中明确策略选择和执行依据"),
    ).toBeInTheDocument();

    expect(screen.getByText("投递建议")).toBeInTheDocument();
    expect(screen.getByText("补充后可投")).toBeInTheDocument();
    expect(screen.getByText("已通过 2/5 个招聘阶段")).toBeInTheDocument();
    expect(screen.getByText("五维招聘证据评测")).toBeInTheDocument();
    expect(screen.getByText("岗位关键词证据")).toBeInTheDocument();
    expect(screen.getByText("岗位能力证据")).toBeInTheDocument();
    expect(screen.getByText("经历与成果证据")).toBeInTheDocument();
    expect(screen.getByText("面试表达素材")).toBeInTheDocument();
    expect(screen.getByText("面试表达素材有限。")).toBeInTheDocument();
    expect(screen.getAllByText("证据偏弱")).toHaveLength(3);
    const rewriteLinks = screen.getAllByRole("link", {
      name: "根据卡点改写简历",
    });
    expect(rewriteLinks).toHaveLength(2);
    expect(rewriteLinks[0]).toHaveAttribute("href", "/resume");
    expect(rewriteLinks[1]).toHaveAttribute("href", "/resume");
    expect(screen.getByText(/候选人：应届生/)).toBeInTheDocument();
    expect(screen.getByText(/标准：校招 \/ 初级岗位/)).toBeInTheDocument();
    expect(
      screen.getByText(/职业：市场销售与商业运营 \/ 市场运营专员/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("简历显示为应届毕业生，岗位面向校招且未要求全职年限。"),
    ).toBeInTheDocument();
  });

  it("shows entry to interview without inventing a bottleneck when every stage passes", () => {
    const passedSimulation: HiringSimulation = {
      evaluation_context: simulation.evaluation_context,
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

    render(<ResultView simulation={passedSimulation} />);

    expect(screen.getByText("准备迎接面试吧！")).toBeInTheDocument();
    expect(screen.getByText("模拟筛选已通过")).toBeInTheDocument();
    expect(
      screen.getByText(/把经历细节、专业判断和可验证结果讲清楚/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/你被淘汰在/)).not.toBeInTheDocument();
  });
});

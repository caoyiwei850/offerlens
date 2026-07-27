import { describe, expect, it } from "vitest";

import { analysisFixture } from "@/test/resume-fixtures";
import { compareJobs } from "./compare";

function simulation(status: "READY" | "REVISE_AND_APPLY" | "HOLD") {
  const finalResult = status === "READY" ? "PASS" as const : "REJECT" as const;
  const failIndex = status === "READY" ? -1 : status === "REVISE_AND_APPLY" ? 3 : 1;
  return {
    ...analysisFixture,
    final_result: finalResult,
    bottleneck_stage: failIndex === -1 ? "" : analysisFixture.flow[failIndex].stage,
    bottleneck_reason: failIndex === -1 ? "" : analysisFixture.flow[failIndex].reason,
    flow: analysisFixture.flow.map((stage, index) => ({
      ...stage,
      status:
        status === "READY"
          ? "PASS" as const
          : index < failIndex
            ? "PASS" as const
            : index === failIndex
              ? "FAIL" as const
              : "SKIPPED" as const,
      reason:
        status === "READY" || index <= failIndex
          ? stage.reason
          : "因前序阶段未通过，未进入本阶段。",
    })),
    passed_stage_count: undefined,
    application_status: undefined,
  };
}

describe("compareJobs", () => {
  it("orders jobs by action status and progress without producing offer odds", async () => {
    const responses = [
      JSON.stringify(simulation("HOLD"), (_key, value) => value === undefined ? undefined : value),
      JSON.stringify(simulation("READY"), (_key, value) => value === undefined ? undefined : value),
    ];

    const result = await compareJobs(
      {
        resumeText: "简历",
        jobs: [
          { id: "weak", title: "弱匹配岗位", description: "岗位一" },
          { id: "ready", title: "强匹配岗位", description: "岗位二" },
        ],
      },
      async () => responses.shift() ?? "{}",
    );

    expect(result.summary.bestJobId).toBe("ready");
    expect(result.summary.overallAdvice).not.toMatch(/\d+\s*%|概率为|录用率/);
    expect(result.results[0].priority).toBe("PRIORITY_APPLY");
  });
});

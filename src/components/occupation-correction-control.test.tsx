import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OccupationCorrectionControl } from "./occupation-correction-control";
import { saveResumeWorkspace } from "@/lib/client/resume-workspace";
import {
  evaluationContext,
  evidenceAssessment,
} from "@/test/hiring-fixtures";

vi.mock("@/lib/client/device-identity", () => ({
  getDeviceIdentity: async () => ({
    deviceId: "a".repeat(64),
    fingerprint: "b".repeat(64),
  }),
}));

const correctedResponse = {
  evaluation_context: {
    ...evaluationContext,
    occupation_family: "HEALTHCARE_CARE",
    occupation_name: "养老护理员",
    occupation_source: "USER_OVERRIDE",
  },
  flow: [
    { stage: "材料初筛", status: "PASS", reason: "材料完整。" },
    { stage: "硬性条件核验", status: "PASS", reason: "条件符合。" },
    { stage: "岗位能力匹配", status: "FAIL", reason: "护理证据偏弱。" },
    { stage: "经历证据评估", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
    { stage: "面试决策", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
  ],
  bottleneck_stage: "岗位能力匹配",
  bottleneck_reason: "护理证据偏弱。",
  final_result: "REJECT",
  improvements: ["补充照护案例", "补充培训证明", "准备安全处置案例"],
  evidence_assessment: evidenceAssessment,
  passed_stage_count: 2,
  application_status: "REVISE_AND_APPLY",
  correction: null,
};

describe("OccupationCorrectionControl", () => {
  beforeEach(() => {
    sessionStorage.clear();
    saveResumeWorkspace({
      resumeText: "三年养老护理经历",
      jd: "养老护理员，要求照护培训和安全意识",
      occupationFamily: "AUTO",
    });
  });

  it("lets an auto-classified user submit one free occupation correction", async () => {
    const onCorrected = vi.fn();
    const fetchMock = vi.fn(
      async (...args: [RequestInfo | URL, RequestInit?]) => {
        void args;
        return new Response(JSON.stringify(correctedResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OccupationCorrectionControl
        context={evaluationContext}
        correction={{
          token: "c".repeat(32),
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }}
        onCorrected={onCorrected}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "识别不准确？" }));
    fireEvent.change(screen.getByLabelText("更正职业领域"), {
      target: { value: "HEALTHCARE_CARE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "免费重新评测" }));

    await waitFor(() => expect(onCorrected).toHaveBeenCalledOnce());
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("occupationFamily")).toBe("HEALTHCARE_CARE");
    expect(body.get("correctionToken")).toBe("c".repeat(32));
  });
});

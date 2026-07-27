import { describe, expect, it } from "vitest";

import {
  deriveApplicationOutcome,
  type EvidenceAssessment,
  type EvidenceLevel,
} from "./evidence";

const stages = [
  "材料初筛",
  "硬性条件核验",
  "岗位能力匹配",
  "经历证据评估",
  "面试决策",
] as const;

function assessment(
  overrides: Partial<Record<keyof EvidenceAssessment["dimensions"], EvidenceLevel>> = {},
): EvidenceAssessment {
  const dimension = (level: EvidenceLevel) => ({
    level,
    reason: "招聘证据判断。",
    suggestion: "补充一项具体证据。",
  });
  return {
    summary: "五维招聘证据总结。",
    dimensions: {
      keywordMatch: dimension(overrides.keywordMatch ?? "SUFFICIENT"),
      basicQualification: dimension(overrides.basicQualification ?? "SUFFICIENT"),
      competencyFit: dimension(overrides.competencyFit ?? "SUFFICIENT"),
      experienceEvidence: dimension(overrides.experienceEvidence ?? "SUFFICIENT"),
      interviewReadiness: dimension(overrides.interviewReadiness ?? "SUFFICIENT"),
    },
  };
}

function flow(failedIndex = -1) {
  return stages.map((stage, index) => ({
    stage,
    status:
      failedIndex === -1
        ? ("PASS" as const)
        : index < failedIndex
          ? ("PASS" as const)
          : index === failedIndex
            ? ("FAIL" as const)
            : ("SKIPPED" as const),
  }));
}

describe("deriveApplicationOutcome", () => {
  it("holds an application when material screening or hard requirements fail", () => {
    expect(deriveApplicationOutcome(flow(0), assessment())).toEqual({
      passed_stage_count: 0,
      application_status: "HOLD",
    });
    expect(deriveApplicationOutcome(flow(1), assessment())).toEqual({
      passed_stage_count: 1,
      application_status: "HOLD",
    });
  });

  it("holds an application when foundational evidence is missing", () => {
    expect(
      deriveApplicationOutcome(
        flow(),
        assessment({ basicQualification: "MISSING" }),
      ),
    ).toEqual({
      passed_stage_count: 5,
      application_status: "HOLD",
    });
  });

  it("asks for revision after a later-stage rejection or other missing evidence", () => {
    expect(deriveApplicationOutcome(flow(2), assessment()).application_status).toBe(
      "REVISE_AND_APPLY",
    );
    expect(
      deriveApplicationOutcome(
        flow(),
        assessment({ experienceEvidence: "MISSING" }),
      ).application_status,
    ).toBe("REVISE_AND_APPLY");
  });

  it("marks an all-pass result with weak evidence as ready", () => {
    expect(
      deriveApplicationOutcome(
        flow(),
        assessment({ interviewReadiness: "WEAK" }),
      ),
    ).toEqual({
      passed_stage_count: 5,
      application_status: "READY",
    });
  });

  it("reserves stretch status for an all-pass result with all evidence sufficient", () => {
    expect(deriveApplicationOutcome(flow(), assessment())).toEqual({
      passed_stage_count: 5,
      application_status: "STRETCH",
    });
  });
});

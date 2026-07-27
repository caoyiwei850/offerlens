export const EVIDENCE_DIMENSIONS = {
  keywordMatch: { label: "岗位关键词证据" },
  basicQualification: { label: "硬性条件与资质" },
  competencyFit: { label: "岗位能力证据" },
  experienceEvidence: { label: "经历与成果证据" },
  interviewReadiness: { label: "面试表达素材" },
} as const;

export type EvidenceDimensionKey = keyof typeof EVIDENCE_DIMENSIONS;
export type EvidenceLevel = "SUFFICIENT" | "WEAK" | "MISSING";
export type ApplicationStatus =
  | "HOLD"
  | "REVISE_AND_APPLY"
  | "READY"
  | "STRETCH";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  HOLD: "暂缓投递",
  REVISE_AND_APPLY: "补充后可投",
  READY: "可以投递",
  STRETCH: "建议冲刺",
};

export interface EvidenceDimension {
  level: EvidenceLevel;
  reason: string;
  suggestion: string;
}

export interface EvidenceAssessment {
  summary: string;
  dimensions: Record<EvidenceDimensionKey, EvidenceDimension>;
}

interface FlowStep {
  status: "PASS" | "FAIL" | "SKIPPED";
}

export interface ApplicationOutcome {
  passed_stage_count: number;
  application_status: ApplicationStatus;
}

export function deriveApplicationOutcome(
  flow: FlowStep[],
  assessment: EvidenceAssessment,
): ApplicationOutcome {
  const passedStageCount = flow.filter((step) => step.status === "PASS").length;
  const failedIndex = flow.findIndex((step) => step.status === "FAIL");
  const dimensions = Object.values(assessment.dimensions);
  const foundationalEvidenceMissing =
    assessment.dimensions.keywordMatch.level === "MISSING" ||
    assessment.dimensions.basicQualification.level === "MISSING";

  let applicationStatus: ApplicationStatus;
  if ((failedIndex >= 0 && failedIndex <= 1) || foundationalEvidenceMissing) {
    applicationStatus = "HOLD";
  } else if (
    failedIndex >= 2 ||
    dimensions.some((dimension) => dimension.level === "MISSING")
  ) {
    applicationStatus = "REVISE_AND_APPLY";
  } else if (dimensions.every((dimension) => dimension.level === "SUFFICIENT")) {
    applicationStatus = "STRETCH";
  } else {
    applicationStatus = "READY";
  }

  return {
    passed_stage_count: passedStageCount,
    application_status: applicationStatus,
  };
}

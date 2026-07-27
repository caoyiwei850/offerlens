import { z } from "zod";

import {
  deriveApplicationOutcome,
  type EvidenceAssessment,
} from "./evidence";
import { occupationFamilySchema, type OccupationFamily } from "./occupation";

export const HIRING_STAGES = [
  "材料初筛",
  "硬性条件核验",
  "岗位能力匹配",
  "经历证据评估",
  "面试决策",
] as const;

const exactThreeStrings = z.array(z.string().trim().min(1)).length(3);
const assessmentText = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/(未评估|无法评估|不做评估)/.test(value), {
    message: "五维招聘证据评测不能省略任何维度",
  });
const assessmentSuggestion = assessmentText.refine(
  (value) => !/^(无|暂无|无需|没有)[。.!！]?$/.test(value),
  { message: "五维招聘证据评测必须提供可执行建议" },
);

const flowStageSchema = z
  .object({
    stage: z.string().trim().min(1),
    status: z.enum(["PASS", "FAIL", "SKIPPED"]),
    reason: z.string().trim().min(1),
  })
  .strict();

export const evaluationContextSchema = z
  .object({
    candidate_type: z.enum(["INTERN", "FRESH_GRADUATE", "EXPERIENCED"]),
    job_track: z.enum(["INTERNSHIP", "CAMPUS", "EXPERIENCED"]),
    occupation_family: occupationFamilySchema,
    occupation_name: z.string().trim().min(1).max(80),
    occupation_source: z.enum(["AUTO", "USER_OVERRIDE"]),
    basis: assessmentText,
  })
  .strict();

export const evidenceAssessmentSchema: z.ZodType<EvidenceAssessment> = z
  .object({
    summary: assessmentText,
    dimensions: z
      .object({
        keywordMatch: evidenceDimensionSchema(),
        basicQualification: evidenceDimensionSchema(),
        competencyFit: evidenceDimensionSchema(),
        experienceEvidence: evidenceDimensionSchema(),
        interviewReadiness: evidenceDimensionSchema(),
      })
      .strict(),
  })
  .strict();

function evidenceDimensionSchema() {
  return z
    .object({
      level: z.enum(["SUFFICIENT", "WEAK", "MISSING"]),
      reason: assessmentText,
      suggestion: assessmentSuggestion,
    })
    .strict();
}

const sharedSimulationFields = {
  evaluation_context: evaluationContextSchema,
  flow: z.array(flowStageSchema).length(HIRING_STAGES.length),
  bottleneck_stage: z.string().trim(),
  bottleneck_reason: z.string().trim(),
  final_result: z.enum(["PASS", "REJECT"]),
  improvements: exactThreeStrings,
  evidence_assessment: evidenceAssessmentSchema,
};

interface FlowSimulation {
  flow: Array<{
    stage: string;
    status: "PASS" | "FAIL" | "SKIPPED";
    reason: string;
  }>;
  bottleneck_stage: string;
  bottleneck_reason: string;
  final_result: "PASS" | "REJECT";
}

function validateFlow(simulation: FlowSimulation, context: z.RefinementCtx) {
  simulation.flow.forEach((step, index) => {
    if (step.stage !== HIRING_STAGES[index]) {
      context.addIssue({
        code: "custom",
        path: ["flow", index, "stage"],
        message: `阶段必须为“${HIRING_STAGES[index]}”`,
      });
    }
  });

  const failedIndexes = simulation.flow.flatMap((step, index) =>
    step.status === "FAIL" ? [index] : [],
  );
  if (failedIndexes.length > 1) {
    context.addIssue({
      code: "custom",
      path: ["flow"],
      message: "招聘流程只能有一个淘汰断点",
    });
  }

  const failedIndex = failedIndexes[0] ?? -1;
  simulation.flow.forEach((step, index) => {
    const expectedStatus =
      failedIndex === -1
        ? "PASS"
        : index < failedIndex
          ? "PASS"
          : index === failedIndex
            ? "FAIL"
            : "SKIPPED";
    if (step.status !== expectedStatus) {
      context.addIssue({
        code: "custom",
        path: ["flow", index, "status"],
        message: `该阶段状态必须为 ${expectedStatus}`,
      });
    }
  });

  if (failedIndex === -1) {
    if (simulation.final_result !== "PASS") {
      context.addIssue({
        code: "custom",
        path: ["final_result"],
        message: "全部阶段通过时最终结果必须为 PASS",
      });
    }
    if (simulation.bottleneck_stage || simulation.bottleneck_reason) {
      context.addIssue({
        code: "custom",
        path: ["bottleneck_stage"],
        message: "全部阶段通过时不能存在淘汰断点",
      });
    }
    return;
  }

  const failedStep = simulation.flow[failedIndex];
  if (simulation.final_result !== "REJECT") {
    context.addIssue({
      code: "custom",
      path: ["final_result"],
      message: "存在失败阶段时最终结果必须为 REJECT",
    });
  }
  if (simulation.bottleneck_stage !== failedStep.stage) {
    context.addIssue({
      code: "custom",
      path: ["bottleneck_stage"],
      message: "淘汰阶段必须对应首个 FAIL 阶段",
    });
  }
  if (simulation.bottleneck_reason !== failedStep.reason) {
    context.addIssue({
      code: "custom",
      path: ["bottleneck_reason"],
      message: "淘汰原因必须与 FAIL 阶段原因一致",
    });
  }
}

export const modelHiringSimulationSchema = z
  .object(sharedSimulationFields)
  .strict()
  .superRefine(validateFlow);

export const hiringSimulationSchema = z
  .object({
    ...sharedSimulationFields,
    passed_stage_count: z.number().int().min(0).max(HIRING_STAGES.length),
    application_status: z.enum([
      "HOLD",
      "REVISE_AND_APPLY",
      "READY",
      "STRETCH",
    ]),
  })
  .strict()
  .superRefine((simulation, context) => {
    validateFlow(simulation, context);
    const expected = deriveApplicationOutcome(
      simulation.flow,
      simulation.evidence_assessment,
    );
    if (simulation.passed_stage_count !== expected.passed_stage_count) {
      context.addIssue({
        code: "custom",
        path: ["passed_stage_count"],
        message: "流程进度必须由 PASS 阶段数量计算",
      });
    }
    if (simulation.application_status !== expected.application_status) {
      context.addIssue({
        code: "custom",
        path: ["application_status"],
        message: "投递状态与招聘路径及证据状态不一致",
      });
    }
  });

export const occupationCorrectionSchema = z
  .object({
    token: z.string().min(20).max(200),
    expires_at: z.iso.datetime(),
  })
  .strict();

export const analyzeResponseSchema = z.intersection(
  hiringSimulationSchema,
  z.object({ correction: occupationCorrectionSchema.nullable() }),
);

export type EvaluationContext = z.infer<typeof evaluationContextSchema>;
export type HiringSimulation = z.infer<typeof hiringSimulationSchema>;
export type ModelHiringSimulation = z.infer<typeof modelHiringSimulationSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
export type OccupationCorrection = z.infer<typeof occupationCorrectionSchema>;

export interface AnalysisInput {
  resume: string;
  jd: string;
  occupationOverride?: OccupationFamily;
}

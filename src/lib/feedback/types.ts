import { z } from "zod";

import { occupationFamilySchema } from "@/lib/analysis/occupation";

export const feedbackKindSchema = z.enum([
  "INTERVIEW_OUTCOME",
  "PRODUCT_SUGGESTION",
]);

export const interviewOutcomeSchema = z.enum([
  "ONGOING",
  "OFFERED",
  "REJECTED",
  "WITHDREW",
]);

export const predictionMatchSchema = z.enum([
  "MATCHED",
  "PARTLY_MATCHED",
  "NOT_MATCHED",
  "UNSURE",
]);

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const feedbackSubmissionSchema = z
  .object({
    kind: feedbackKindSchema,
    outcome: interviewOutcomeSchema.optional(),
    predictionMatch: predictionMatchSchema.optional(),
    rating: z.number().int().min(1).max(5),
    content: z.string().trim().min(2).max(500),
    occupationFamily: occupationFamilySchema.optional(),
    deviceId: digestSchema,
    fingerprint: digestSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "INTERVIEW_OUTCOME") {
      if (!value.outcome) {
        context.addIssue({
          code: "custom",
          path: ["outcome"],
          message: "请选择实际面试进展",
        });
      }
      if (!value.predictionMatch) {
        context.addIssue({
          code: "custom",
          path: ["predictionMatch"],
          message: "请选择模拟判断与实际面试的吻合程度",
        });
      }
      return;
    }
    if (value.outcome || value.predictionMatch) {
      context.addIssue({
        code: "custom",
        path: ["kind"],
        message: "产品建议不能包含尚未发生的面试判断",
      });
    }
  })
  .transform((value) => ({
    ...value,
    outcome: value.outcome ?? null,
    predictionMatch: value.predictionMatch ?? null,
    occupationFamily: value.occupationFamily ?? null,
  }));

export const feedbackAdminQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type FeedbackKind = z.infer<typeof feedbackKindSchema>;
export type InterviewOutcome = z.infer<typeof interviewOutcomeSchema>;
export type PredictionMatch = z.infer<typeof predictionMatchSchema>;

export interface FeedbackSubmission {
  id: string;
  status: "RECEIVED";
}

export interface FeedbackEntry {
  id: string;
  kind: FeedbackKind;
  outcome: InterviewOutcome | null;
  predictionMatch: PredictionMatch | null;
  rating: number;
  content: string;
  occupationFamily: string | null;
  createdAt: string;
}

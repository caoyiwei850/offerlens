import { z } from "zod";

import { occupationFamilySchema } from "@/lib/analysis/occupation";

export const ANALYTICS_EVENT_TYPES = [
  "LANDING_VIEWED",
  "ANALYSIS_STARTED",
  "ANALYSIS_SUCCEEDED",
  "ANALYSIS_FAILED",
  "RESULT_VIEWED",
  "RESUME_WORKBENCH_VIEWED",
  "RESUME_PLAN_SUCCEEDED",
  "RESUME_REWRITE_SUCCEEDED",
  "RESUME_EXPORTED",
  "SHARE_VIEWED",
  "SHARE_ACTION",
  "FEEDBACK_VIEWED",
  "FEEDBACK_SUBMITTED",
] as const;

export const analyticsEventTypeSchema = z.enum(ANALYTICS_EVENT_TYPES);

const analyticsDimensionsSchema = z
  .object({
    occupationFamily: occupationFamilySchema.optional(),
    result: z.enum(["PASS", "REJECT"]).optional(),
    applicationStatus: z
      .enum(["HOLD", "REVISE_AND_APPLY", "READY", "STRETCH"])
      .optional(),
    inputMode: z.enum(["TEXT", "PDF", "DOCX"]).optional(),
    errorCode: z
      .string()
      .regex(/^[A-Z0-9_]{2,64}$/)
      .optional(),
    durationMs: z.number().int().min(0).max(10 * 60 * 1000).optional(),
    format: z.enum(["PDF", "DOCX"]).optional(),
    action: z.enum(["COPY_TEXT", "COPY_IMAGE", "DOWNLOAD_IMAGE"]).optional(),
    feedbackKind: z
      .enum(["INTERVIEW_OUTCOME", "PRODUCT_SUGGESTION"])
      .optional(),
  })
  .strict();

export const analyticsEventSchema = z
  .object({
    eventId: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
    sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
    type: analyticsEventTypeSchema,
    dimensions: analyticsDimensionsSchema,
  })
  .strict();

export const analyticsSummaryQuerySchema = z.object({
  days: z
    .union([z.literal("7"), z.literal("30"), z.literal(7), z.literal(30)])
    .transform(Number),
});

export type AnalyticsEventType = z.infer<typeof analyticsEventTypeSchema>;
export type AnalyticsDimensions = z.infer<typeof analyticsDimensionsSchema>;
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export interface AnalyticsSummary {
  days: number;
  funnel: {
    landingSessions: number;
    analysisStartedSessions: number;
    analysisSucceededSessions: number;
    resultViewedSessions: number;
    resumeWorkbenchSessions: number;
    resumeRewriteSessions: number;
    resumeExportSessions: number;
    shareActionSessions: number;
    activationRate: number | null;
    completionRate: number | null;
  };
  events: Record<AnalyticsEventType, number>;
  errors: Array<{ errorCode: string; events: number }>;
  occupations: Array<{ occupationFamily: string; sessions: number }>;
  daily: Array<{
    date: string;
    landingSessions: number;
    analysisSucceededSessions: number;
  }>;
}

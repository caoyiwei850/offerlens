import { z } from "zod";

import { hiringSimulationSchema } from "@/lib/analysis/types";
import {
  factSchema,
  resumeDraftSchema,
  resumePlanResponseSchema,
  resumeRewriteResponseSchema,
} from "@/lib/resume-workbench/types";

const idSchema = z.string().trim().min(1).max(120);
const titleSchema = z.string().trim().min(1).max(200);

export const resumeProfileInputSchema = z
  .object({
    title: titleSchema,
    resumeText: z.string().trim().min(1).max(12_000),
  })
  .strict();

export const applicationInputSchema = z
  .object({
    resumeProfileId: idSchema.optional(),
    title: titleSchema.optional(),
    resumeText: z.string().trim().min(1).max(12_000),
    jobTitle: titleSchema.optional(),
    jobDescription: z.string().trim().min(1).max(8_000),
    analysis: hiringSimulationSchema.optional(),
  })
  .strict();

export const importSessionSchema = z
  .object({
    clientImportId: z.string().trim().min(8).max(120),
    resumeTitle: titleSchema.optional(),
    resumeText: z.string().trim().min(1).max(12_000),
    jobTitle: titleSchema.optional(),
    jobDescription: z.string().trim().min(1).max(8_000),
    analysis: hiringSimulationSchema,
    correction: z.unknown().optional(),
    workbenchState: z.unknown().optional(),
    plan: resumePlanResponseSchema.optional(),
    rewritten: resumeRewriteResponseSchema.optional(),
  })
  .strict();

export const resumeVersionInputSchema = z
  .object({
    title: titleSchema,
    draft: resumeDraftSchema,
    facts: z.array(factSchema).max(160).optional(),
    source: z.enum(["MANUAL", "AI_REWRITE", "IMPORTED"]).default("MANUAL"),
  })
  .strict();

export const reviewIssueSchema = z
  .object({
    id: idSchema,
    type: z.enum([
      "EVIDENCE_GAP",
      "OVERCLAIM",
      "KEYWORD_MISSING",
      "FACT_LINK_BROKEN",
      "INTERVIEW_RISK",
      "READABILITY",
    ]),
    severity: z.enum(["INFO", "WARNING", "BLOCKING"]),
    location: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(600),
    suggestion: z.string().trim().min(1).max(600),
    safeAutoFix: z.boolean(),
    needsUserEvidence: z.boolean(),
  })
  .strict();

export const reviewReportSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_000),
    issues: z.array(reviewIssueSchema).max(30),
    safeRewriteNotes: z.array(z.string().trim().min(1).max(300)).max(12),
  })
  .strict();

export const interviewQuestionSchema = z
  .object({
    id: idSchema,
    question: z.string().trim().min(1).max(500),
    whyAsked: z.string().trim().min(1).max(500),
    evidenceToPrepare: z.array(z.string().trim().min(1).max(200)).min(1).max(6),
    answerStructure: z.string().trim().min(1).max(800),
    fabricationBoundary: z.string().trim().min(1).max(500),
  })
  .strict();

export const interviewPackSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_000),
    questions: z.array(interviewQuestionSchema).min(1).max(30),
  })
  .strict();

export type ResumeProfileInput = z.infer<typeof resumeProfileInputSchema>;
export type ApplicationInput = z.infer<typeof applicationInputSchema>;
export type ImportSessionInput = z.infer<typeof importSessionSchema>;
export type ResumeVersionInput = z.infer<typeof resumeVersionInputSchema>;
export type ReviewReport = z.infer<typeof reviewReportSchema>;
export type InterviewPack = z.infer<typeof interviewPackSchema>;

export interface ResumeProfile {
  id: string;
  title: string;
  resumeText: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobSnapshot {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface ApplicationWorkspace {
  id: string;
  resumeProfileId: string;
  jobSnapshotId: string;
  title: string;
  analysis: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeVersion {
  id: string;
  applicationId: string;
  title: string;
  draft: unknown;
  facts: unknown[];
  source: "MANUAL" | "AI_REWRITE" | "IMPORTED";
  createdAt: string;
}

export interface ReviewReportRecord {
  id: string;
  applicationId: string;
  resumeVersionId: string;
  report: ReviewReport;
  createdAt: string;
}

export interface InterviewPackRecord {
  id: string;
  applicationId: string;
  resumeVersionId: string;
  pack: InterviewPack;
  createdAt: string;
}

export interface ApplicationDetails extends ApplicationWorkspace {
  resumeProfile: ResumeProfile;
  jobSnapshot: JobSnapshot;
  resumeVersions: ResumeVersion[];
  reviewReports: ReviewReportRecord[];
  interviewPacks: InterviewPackRecord[];
}

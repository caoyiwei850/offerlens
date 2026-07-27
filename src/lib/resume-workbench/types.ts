import { z } from "zod";

import { hiringSimulationSchema } from "@/lib/analysis/types";
import { MAX_GUIDED_QUESTIONS } from "./guidance";

const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const text = z.string().trim().max(2_000);
const shortText = z.string().trim().max(200);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const factSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().min(1).max(1_000),
    source: z.enum(["RESUME", "ANSWER"]),
  })
  .strict();

export const resumeBulletSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().min(1).max(500),
    factRefs: z.array(idSchema).min(1).max(10),
    status: z.enum(["SOURCE", "AI_REWRITE", "NEEDS_INPUT"]),
  })
  .strict();

const educationSchema = z
  .object({
    id: idSchema,
    school: shortText,
    degree: shortText,
    major: shortText,
    startDate: z.string().trim().max(20),
    endDate: z.string().trim().max(20),
    details: z.array(shortText).max(10),
  })
  .strict();

const experienceSchema = z
  .object({
    id: idSchema,
    organization: shortText,
    title: shortText,
    startDate: z.string().trim().max(20),
    endDate: z.string().trim().max(20),
    type: z.enum([
      "FULL_TIME",
      "INTERNSHIP",
      "PART_TIME",
      "CAMPUS",
      "FREELANCE",
      "VOLUNTEER",
      "SELF_EMPLOYED",
      "PRACTICUM",
      "OTHER",
    ]),
    bullets: z.array(resumeBulletSchema).max(20),
  })
  .strict();

const projectSchema = z
  .object({
    id: idSchema,
    name: shortText,
    role: shortText,
    startDate: z.string().trim().max(20),
    endDate: z.string().trim().max(20),
    bullets: z.array(resumeBulletSchema).max(20),
  })
  .strict();

export const resumeDraftSchema = z
  .object({
    basics: z
      .object({
        name: shortText,
        phone: shortText,
        email: shortText,
        location: shortText,
        targetRole: shortText,
        summary: text,
      })
      .strict(),
    education: z.array(educationSchema).max(10),
    experiences: z.array(experienceSchema).max(20),
    projects: z.array(projectSchema).max(20),
    skills: z.array(shortText).max(50),
    certificates: z.array(shortText).max(30),
  })
  .strict();

export const gapQuestionSchema = z
  .object({
    id: idSchema,
    prompt: z.string().trim().min(1).max(300),
    reason: z.string().trim().min(1).max(300),
    employerNeed: z.string().trim().min(1).max(200),
    whyItMatters: z.string().trim().min(1).max(300),
    possibleSources: z.array(shortText).min(2).max(6),
    answerMode: z.enum(["GUIDED_EXPERIENCE", "DIRECT_CONFIRMATION"]),
    targetPath: z.string().trim().min(1).max(200),
    required: z.boolean(),
    issueIds: z.array(idSchema).max(10),
  })
  .strict();

export const consistencyIssueSchema = z
  .object({
    id: idSchema,
    code: z.string().regex(/^[A-Z0-9_]{2,64}$/),
    severity: z.enum(["WARNING", "BLOCKING"]),
    message: z.string().trim().min(1).max(500),
    relatedPaths: z.array(z.string().trim().max(200)).max(10),
    questionId: idSchema.optional(),
    resolved: z.boolean(),
  })
  .strict();

export const templateIdSchema = z.enum([
  "EXPERIENCE",
  "PROFESSIONAL",
  "CAMPUS",
]);

export const resumePlanModelSchema = z
  .object({
    draft: resumeDraftSchema,
    questions: z.array(gapQuestionSchema).max(MAX_GUIDED_QUESTIONS),
    issues: z.array(consistencyIssueSchema).max(20),
    recommendedTemplate: templateIdSchema,
  })
  .strict();

export const resumePlanResponseSchema = resumePlanModelSchema.extend({
  facts: z.array(factSchema).max(120),
  rewriteToken: z.string().min(32).max(200),
});

export const resumePlanRequestSchema = z
  .object({
    resumeText: z.string().trim().min(1).max(8_000),
    jd: z.string().trim().min(1).max(5_000),
    analysis: hiringSimulationSchema,
    deviceId: digestSchema,
    fingerprint: digestSchema,
  })
  .strict();

export const answerSchema = z
  .object({
    questionId: idSchema,
    status: z.enum(["HAS_EVIDENCE", "NO_EVIDENCE", "UNSURE"]),
    detail: z.string().trim().max(1_000).optional(),
  })
  .strict()
  .superRefine((answer, ctx) => {
    if (answer.status === "HAS_EVIDENCE" && !answer.detail) {
      ctx.addIssue({
        code: "custom",
        path: ["detail"],
        message: "请填写真实经历后再选择“我有类似经历”",
      });
    }
  });

export const resumeRewriteRequestSchema = z
  .object({
    draft: resumeDraftSchema,
    facts: z.array(factSchema).max(120),
    questions: z.array(gapQuestionSchema).max(MAX_GUIDED_QUESTIONS),
    issues: z.array(consistencyIssueSchema).max(20),
    answers: z.array(answerSchema).max(MAX_GUIDED_QUESTIONS),
    factsConfirmed: z.literal(true),
    template: templateIdSchema,
    rewriteToken: z.string().min(32).max(200),
    deviceId: digestSchema,
    fingerprint: digestSchema,
  })
  .strict();

export const resumeRewriteModelSchema = z
  .object({
    draft: resumeDraftSchema,
    changeSummary: z.array(z.string().trim().min(1).max(300)).max(20),
    unresolvedIssues: z.array(consistencyIssueSchema).max(20),
  })
  .strict();

export const resumeRewriteResponseSchema = resumeRewriteModelSchema.extend({
  facts: z.array(factSchema).max(140),
});

export const resumeExportRequestSchema = z
  .object({
    draft: resumeDraftSchema,
    template: templateIdSchema,
    unresolvedIssues: z.array(consistencyIssueSchema).max(20),
  })
  .strict();

export type Fact = z.infer<typeof factSchema>;
export type ResumeBullet = z.infer<typeof resumeBulletSchema>;
export type ResumeDraft = z.infer<typeof resumeDraftSchema>;
export type GapQuestion = z.infer<typeof gapQuestionSchema>;
export type EvidenceAnswer = z.infer<typeof answerSchema>;
export type ConsistencyIssue = z.infer<typeof consistencyIssueSchema>;
export type TemplateId = z.infer<typeof templateIdSchema>;
export type ResumePlanModel = z.infer<typeof resumePlanModelSchema>;
export type ResumePlanResponse = z.infer<typeof resumePlanResponseSchema>;
export type ResumeRewriteResponse = z.infer<typeof resumeRewriteResponseSchema>;

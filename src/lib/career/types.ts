import { z } from "zod";

import { hiringSimulationSchema } from "@/lib/analysis/types";

export const compareJobInputSchema = z
  .object({
    id: z.string().trim().min(1).max(80).optional(),
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().min(1).max(8_000),
  })
  .strict();

export const compareRequestSchema = z
  .object({
    resumeText: z.string().trim().min(1).max(12_000),
    jobs: z.array(compareJobInputSchema).min(2).max(5),
  })
  .strict();

export const comparePrioritySchema = z.enum([
  "PRIORITY_APPLY",
  "REVISE_FIRST",
  "CAUTIOUS_TRY",
  "HOLD",
]);

export const compareResultSchema = z
  .object({
    jobId: z.string(),
    title: z.string(),
    simulation: hiringSimulationSchema,
    priority: comparePrioritySchema,
    rankReason: z.string(),
  })
  .strict();

export const compareResponseSchema = z
  .object({
    results: z.array(compareResultSchema).min(2).max(5),
    summary: z
      .object({
        bestJobId: z.string(),
        orderedJobIds: z.array(z.string()).min(2).max(5),
        overallAdvice: z.string(),
      })
      .strict(),
  })
  .strict();

export type CompareRequest = z.infer<typeof compareRequestSchema>;
export type CompareResponse = z.infer<typeof compareResponseSchema>;
export type ComparePriority = z.infer<typeof comparePrioritySchema>;


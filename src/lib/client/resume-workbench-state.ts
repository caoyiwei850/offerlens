import {
  answerSchema,
  resumeDraftSchema,
  resumePlanResponseSchema,
  resumeRewriteResponseSchema,
  templateIdSchema,
  type ResumeDraft,
  type EvidenceAnswer,
  type ResumePlanResponse,
  type ResumeRewriteResponse,
  type TemplateId,
} from "@/lib/resume-workbench/types";

const STATE_KEY = "offerlens_resume_workbench_v3";

export interface ResumeWorkbenchState {
  plan: ResumePlanResponse;
  rewritten: ResumeRewriteResponse | null;
  draft: ResumeDraft;
  template: TemplateId;
  answers: Record<string, EvidenceAnswer>;
}

export function saveResumeWorkbenchState(value: ResumeWorkbenchState): void {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(value));
}

export function loadResumeWorkbenchState(): ResumeWorkbenchState | null {
  const raw = sessionStorage.getItem(STATE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      plan: resumePlanResponseSchema.parse(value.plan),
      rewritten:
        value.rewritten === null || value.rewritten === undefined
          ? null
          : resumeRewriteResponseSchema.parse(value.rewritten),
      draft: resumeDraftSchema.parse(value.draft),
      template: templateIdSchema.parse(value.template),
      answers:
        typeof value.answers === "object" && value.answers !== null
          ? Object.fromEntries(
              Object.entries(value.answers).flatMap(([key, answer]) => {
                const parsed = answerSchema.safeParse(answer);
                return parsed.success ? [[key, parsed.data]] : [];
              }),
            )
          : {},
    };
  } catch {
    sessionStorage.removeItem(STATE_KEY);
    return null;
  }
}

export function clearResumeWorkbenchState(): void {
  sessionStorage.removeItem(STATE_KEY);
}

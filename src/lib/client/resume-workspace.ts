import { z } from "zod";
import { occupationFamilySchema } from "@/lib/analysis/occupation";

const WORKSPACE_KEY = "offerlens_resume_workspace_v1";

const workspaceSchema = z
  .object({
    resumeText: z.string().min(1).max(8_000),
    jd: z.string().min(1).max(5_000),
    occupationFamily: z
      .union([z.literal("AUTO"), occupationFamilySchema])
      .optional(),
    updatedAt: z.string(),
  })
  .strict();

export type ResumeWorkspace = z.infer<typeof workspaceSchema>;

export function saveResumeWorkspace(
  value: Omit<ResumeWorkspace, "updatedAt">,
): void {
  sessionStorage.setItem(
    WORKSPACE_KEY,
    JSON.stringify({ ...value, updatedAt: new Date().toISOString() }),
  );
}

export function loadResumeWorkspace(): ResumeWorkspace | null {
  const raw = sessionStorage.getItem(WORKSPACE_KEY);
  if (!raw) return null;
  try {
    return workspaceSchema.parse(JSON.parse(raw));
  } catch {
    sessionStorage.removeItem(WORKSPACE_KEY);
    return null;
  }
}

export function clearResumeWorkspace(): void {
  sessionStorage.removeItem(WORKSPACE_KEY);
}

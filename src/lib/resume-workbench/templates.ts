import type { TemplateId } from "./types";

export interface TemplateTokens {
  label: string;
  accent: string;
  sectionOrder: Array<
    "summary" | "skills" | "experience" | "projects" | "education" | "certificates"
  >;
}

export const RESUME_TEMPLATES: Record<TemplateId, TemplateTokens> = {
  PROFESSIONAL: {
    label: "专业能力版",
    accent: "0F766E",
    sectionOrder: [
      "skills",
      "projects",
      "experience",
      "education",
      "certificates",
      "summary",
    ],
  },
  EXPERIENCE: {
    label: "职业经历版",
    accent: "047857",
    sectionOrder: [
      "summary",
      "experience",
      "skills",
      "projects",
      "education",
      "certificates",
    ],
  },
  CAMPUS: {
    label: "校园应届版",
    accent: "2563EB",
    sectionOrder: [
      "education",
      "projects",
      "experience",
      "skills",
      "certificates",
      "summary",
    ],
  },
};

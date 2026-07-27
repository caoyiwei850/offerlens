const EXPERIENCE_TYPE_ALIASES: Record<string, string> = {
  FULL_TIME: "FULL_TIME",
  全职: "FULL_TIME",
  正式工作: "FULL_TIME",
  INTERNSHIP: "INTERNSHIP",
  实习: "INTERNSHIP",
  PART_TIME: "PART_TIME",
  兼职: "PART_TIME",
  CAMPUS: "CAMPUS",
  校园经历: "CAMPUS",
  FREELANCE: "FREELANCE",
  自由职业: "FREELANCE",
  SELF_EMPLOYED: "SELF_EMPLOYED",
  个体经营: "SELF_EMPLOYED",
  创业: "SELF_EMPLOYED",
  VOLUNTEER: "VOLUNTEER",
  志愿服务: "VOLUNTEER",
  志愿者: "VOLUNTEER",
  PRACTICUM: "PRACTICUM",
  见习: "PRACTICUM",
  临床见习: "PRACTICUM",
  跟岗实践: "PRACTICUM",
  OTHER: "OTHER",
};

function normalizeExperienceType(value: unknown): string {
  if (typeof value !== "string") return "OTHER";
  return EXPERIENCE_TYPE_ALIASES[value.trim()] ?? "OTHER";
}

export function normalizeResumeModelOutput(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  const cloned = structuredClone(value) as {
    draft?: { experiences?: Array<Record<string, unknown>> };
  };
  const experiences = cloned.draft?.experiences;
  if (!Array.isArray(experiences)) return cloned;

  for (const experience of experiences) {
    experience.type = normalizeExperienceType(experience.type);
  }
  return cloned;
}

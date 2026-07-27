import type { ResumeDraft } from "./types";

export function serializeResumeDraft(draft: ResumeDraft): string {
  const lines: string[] = [];
  lines.push(draft.basics.name);
  lines.push(
    [
      draft.basics.phone,
      draft.basics.email,
      draft.basics.location,
      draft.basics.targetRole,
    ]
      .filter(Boolean)
      .join(" | "),
  );
  if (draft.basics.summary) lines.push("\n个人简介", draft.basics.summary);
  if (draft.education.length) {
    lines.push("\n教育经历");
    for (const entry of draft.education) {
      lines.push(
        [
          entry.school,
          entry.degree,
          entry.major,
          entry.startDate,
          entry.endDate,
        ]
          .filter(Boolean)
          .join(" | "),
      );
      entry.details.forEach((detail) => lines.push(`- ${detail}`));
    }
  }
  if (draft.experiences.length) {
    lines.push("\n工作与实习经历");
    for (const entry of draft.experiences) {
      lines.push(
        [
          entry.organization,
          entry.title,
          entry.startDate,
          entry.endDate,
        ]
          .filter(Boolean)
          .join(" | "),
      );
      entry.bullets.forEach((bullet) => lines.push(`- ${bullet.text}`));
    }
  }
  if (draft.projects.length) {
    lines.push("\n项目经历");
    for (const entry of draft.projects) {
      lines.push(
        [entry.name, entry.role, entry.startDate, entry.endDate]
          .filter(Boolean)
          .join(" | "),
      );
      entry.bullets.forEach((bullet) => lines.push(`- ${bullet.text}`));
    }
  }
  if (draft.skills.length) lines.push("\n专业技能", draft.skills.join("、"));
  if (draft.certificates.length) {
    lines.push("\n证书与补充信息", ...draft.certificates.map((item) => `- ${item}`));
  }
  return lines.filter((line) => line !== "").join("\n").trim().slice(0, 8_000);
}

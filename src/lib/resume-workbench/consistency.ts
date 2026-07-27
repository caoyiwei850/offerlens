import type { ConsistencyIssue, ResumeDraft } from "./types";

function parseYear(value: string): number | null {
  const match = value.match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function issue(
  code: string,
  message: string,
  relatedPaths: string[],
): ConsistencyIssue {
  return {
    id: `deterministic-${code.toLowerCase()}`,
    code,
    severity: "BLOCKING",
    message,
    relatedPaths,
    resolved: false,
  };
}

export function detectDeterministicIssues(
  resumeText: string,
  experiences: ResumeDraft["experiences"],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const ageMatch = resumeText.match(/(?:^|\D)(1[6-9]|[2-9]\d)岁/);
  const age = ageMatch ? Number(ageMatch[1]) : null;
  const currentYear = new Date().getFullYear();
  const textYears = [...resumeText.matchAll(/(?:19|20)\d{2}/g)].map((match) =>
    Number(match[0]),
  );
  const experienceYears = experiences
    .filter((entry) => entry.type === "FULL_TIME")
    .map((entry) => parseYear(entry.startDate))
    .filter((value): value is number => value !== null);
  const earliestWorkYear =
    experienceYears.length > 0
      ? Math.min(...experienceYears)
      : textYears.length > 0
        ? Math.min(...textYears)
        : null;

  if (
    age !== null &&
    earliestWorkYear !== null &&
    age - (currentYear - earliestWorkYear) < 18
  ) {
    issues.push(
      issue(
        "WORK_STARTED_TOO_YOUNG",
        "年龄与最早工作时间矛盾，请确认年份或说明该经历是否为校园实践。",
        ["basics", "experiences"],
      ),
    );
  }

  const claimsGraduate = /(刚毕业|应届|应届毕业|毕业不久)/.test(resumeText);
  const fullTimeYears =
    earliestWorkYear === null ? 0 : Math.max(0, currentYear - earliestWorkYear);
  const explicitlyInternshipOnly =
    /(实习|兼职|校园实践)/.test(resumeText) &&
    !/(主管|经理|负责人|正式员工)/.test(resumeText);
  if (claimsGraduate && fullTimeYears >= 2 && !explicitlyInternshipOnly) {
    issues.push(
      issue(
        "GRADUATE_FULL_TIME_CONFLICT",
        "“刚毕业/应届”与多年连续全职经历冲突，请确认工作性质。",
        ["education", "experiences"],
      ),
    );
  }

  const hasDegreeClaim = /(本科|硕士|博士|大专|大学)/.test(resumeText);
  const hasEducationDate = resumeText.split(/\r?\n/).some((line) => {
    const looksEducational = /(本科|硕士|博士|大专|大学|学院)/.test(line);
    return looksEducational && (line.match(/(?:19|20)\d{2}/g)?.length ?? 0) >= 2;
  });
  if (claimsGraduate && hasDegreeClaim && !hasEducationDate) {
    issues.push(
      issue(
        "EDUCATION_DATES_MISSING",
        "应届身份缺少入学和毕业时间，无法核验教育与工作时间线。",
        ["education"],
      ),
    );
  }

  return issues;
}

export function mergeConsistencyIssues(
  deterministic: ConsistencyIssue[],
  modelIssues: ConsistencyIssue[],
): ConsistencyIssue[] {
  const seen = new Set<string>();
  return [...deterministic, ...modelIssues].filter((item) => {
    const key = `${item.code}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

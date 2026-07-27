import type {
  ConsistencyIssue,
  EvidenceAnswer,
  GapQuestion,
} from "./types";

export const MAX_GUIDED_QUESTIONS = 5;

interface GuidedQuestionSetInput {
  questions: GapQuestion[];
  issues: ConsistencyIssue[];
}

const directGuidance: Record<
  string,
  Pick<
    GapQuestion,
    "prompt" | "employerNeed" | "whyItMatters" | "possibleSources" | "targetPath"
  >
> = {
  WORK_STARTED_TOO_YOUNG: {
    prompt:
      "请说明最早一段经历的真实起止时间，以及它属于全职、实习、兼职还是校园实践。",
    employerNeed: "清晰可信的经历时间线",
    whyItMatters: "招聘方会核对年龄、教育和经历时间是否能够互相印证。",
    possibleSources: ["实习经历", "兼职经历", "校园实践", "正式工作"],
    targetPath: "experiences",
  },
  GRADUATE_FULL_TIME_CONFLICT: {
    prompt:
      "“刚毕业/应届”和连续工作经历中，哪一项需要修正？请填写真实毕业时间和每段经历性质。",
    employerNeed: "明确的毕业身份与经历性质",
    whyItMatters: "招聘方需要判断应届身份，以及过往经历应按实习还是全职理解。",
    possibleSources: ["毕业证或学信网时间", "实习证明", "兼职记录", "劳动合同"],
    targetPath: "education",
  },
  EDUCATION_DATES_MISSING: {
    prompt:
      "请填写大学的入学和毕业年月；如果尚未毕业，请填写预计毕业时间。",
    employerNeed: "完整的教育时间",
    whyItMatters: "教育时间用于判断校招资格，并与实习和项目经历交叉核对。",
    possibleSources: ["学信网", "学生证", "毕业证", "预计毕业安排"],
    targetPath: "education",
  },
};

function hasAnswerDetail(answer: EvidenceAnswer): boolean {
  return Boolean(answer.detail?.trim());
}

function generatedQuestion(issue: ConsistencyIssue): GapQuestion {
  const guidance = directGuidance[issue.code] ?? {
    prompt: `${issue.message} 请说明真实情况以及需要修正的内容。`,
    employerNeed: "前后一致且可核实的简历信息",
    whyItMatters: "信息矛盾会降低招聘方对简历真实性的信任。",
    possibleSources: ["教育经历", "实习经历", "项目经历", "相关证明"],
    targetPath: issue.relatedPaths[0] || "basics",
  };
  return {
    id: `question-${issue.code.toLowerCase().replaceAll("_", "-")}`.slice(
      0,
      64,
    ),
    ...guidance,
    reason: issue.message,
    answerMode: "DIRECT_CONFIRMATION",
    required: true,
    issueIds: [issue.id],
  };
}

export function buildGuidedQuestionSet({
  questions,
  issues,
}: GuidedQuestionSetInput): {
  questions: GapQuestion[];
  issues: ConsistencyIssue[];
} {
  const coveredIssueIds = new Set(
    questions.flatMap((question) => question.issueIds),
  );
  const generated = issues
    .filter(
      (issue) =>
        issue.severity === "BLOCKING" && !coveredIssueIds.has(issue.id),
    )
    .map(generatedQuestion);
  const merged = [...generated, ...questions].slice(0, MAX_GUIDED_QUESTIONS);
  const questionByIssue = new Map<string, string>();
  for (const question of merged) {
    for (const issueId of question.issueIds) {
      questionByIssue.set(issueId, question.id);
    }
  }
  return {
    questions: merged,
    issues: issues.map((issue) => {
      const questionId = questionByIssue.get(issue.id);
      return {
        ...issue,
        ...(questionId ? { questionId } : {}),
      };
    }),
  };
}

export function completedQuestionIds(
  questions: GapQuestion[],
  answers: EvidenceAnswer[],
): Set<string> {
  const answersByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  return new Set(
    questions.flatMap((question) => {
      const answer = answersByQuestion.get(question.id);
      if (!answer) return [];
      if (question.answerMode === "DIRECT_CONFIRMATION") {
        return answer.status === "HAS_EVIDENCE" && hasAnswerDetail(answer)
          ? [question.id]
          : [];
      }
      return [question.id];
    }),
  );
}

export function resolveIssuesFromAnswers(
  issues: ConsistencyIssue[],
  questions: GapQuestion[],
  answers: EvidenceAnswer[],
): ConsistencyIssue[] {
  const completed = completedQuestionIds(questions, answers);
  const resolvedIssueIds = new Set(
    questions
      .filter((question) => completed.has(question.id))
      .flatMap((question) => question.issueIds),
  );
  return issues.map((issue) => ({
    ...issue,
    resolved: resolvedIssueIds.has(issue.id),
  }));
}

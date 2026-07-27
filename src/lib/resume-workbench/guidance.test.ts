import { describe, expect, it } from "vitest";

import {
  buildGuidedQuestionSet,
  completedQuestionIds,
  resolveIssuesFromAnswers,
} from "./guidance";
import { detectDeterministicIssues } from "./consistency";
import type { EvidenceAnswer, GapQuestion } from "./types";

const teamworkQuestion: GapQuestion = {
  id: "question-teamwork",
  prompt: "请回忆一次你协调多人完成任务的经历。",
  reason: "岗位要求团队管理经验。",
  employerNeed: "团队管理与协作",
  whyItMatters: "招聘方需要判断你能否推动多人共同完成目标。",
  possibleSources: ["学生会或社团", "课程项目", "竞赛团队", "志愿活动"],
  answerMode: "GUIDED_EXPERIENCE",
  targetPath: "experiences",
  required: false,
  issueIds: [],
};

describe("guided evidence workflow", () => {
  it("links every critical contradiction to a direct confirmation question", () => {
    const issues = detectDeterministicIssues(
      `张三 23岁 大学本科
大学刚毕业
深圳市蓝海优品科技有限公司 电商运营主管 2021.04 — 至今
武汉市锦程电子商务有限公司 电商运营专员 2019.08 — 2021.03`,
      [],
    );

    const result = buildGuidedQuestionSet({
      questions: [teamworkQuestion],
      issues,
    });

    expect(result.questions.length).toBeLessThanOrEqual(5);
    for (const issue of result.issues) {
      const linked = result.questions.find((question) =>
        question.issueIds.includes(issue.id),
      );
      expect(linked?.required).toBe(true);
      expect(linked?.answerMode).toBe("DIRECT_CONFIRMATION");
      expect(issue.questionId).toBe(linked?.id);
    }
  });

  it("keeps guided questions short enough for users to finish", () => {
    const questions = Array.from({ length: 8 }, (_, index) => ({
      ...teamworkQuestion,
      id: `question-${index + 1}`,
      prompt: `请补充第 ${index + 1} 段真实经历。`,
    }));

    const result = buildGuidedQuestionSet({
      questions,
      issues: [],
    });

    expect(result.questions).toHaveLength(5);
    expect(result.questions.map((question) => question.id)).toEqual([
      "question-1",
      "question-2",
      "question-3",
      "question-4",
      "question-5",
    ]);
  });

  it("treats no-evidence as a completed recall choice but not as conflict resolution", () => {
    const answers: EvidenceAnswer[] = [
      { questionId: "question-teamwork", status: "NO_EVIDENCE" },
      {
        questionId: "question-conflict",
        status: "HAS_EVIDENCE",
        detail: "2019—2021 年的经历属于在校兼职",
      },
    ];
    const conflictQuestion: GapQuestion = {
      ...teamworkQuestion,
      id: "question-conflict",
      required: true,
      answerMode: "DIRECT_CONFIRMATION",
      issueIds: ["issue-conflict"],
    };

    expect(
      completedQuestionIds([teamworkQuestion, conflictQuestion], answers),
    ).toEqual(new Set(["question-teamwork", "question-conflict"]));
    expect(
      resolveIssuesFromAnswers(
        [
          {
            id: "issue-conflict",
            code: "TIMELINE_CONFLICT",
            severity: "BLOCKING",
            message: "时间线冲突。",
            relatedPaths: ["experiences"],
            questionId: "question-conflict",
            resolved: false,
          },
        ],
        [teamworkQuestion, conflictQuestion],
        [{ questionId: "question-teamwork", status: "NO_EVIDENCE" }],
      )[0].resolved,
    ).toBe(false);
  });
});

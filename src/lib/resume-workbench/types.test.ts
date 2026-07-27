import { describe, expect, it } from "vitest";

import {
  gapQuestionSchema,
  resumeDraftSchema,
  templateIdSchema,
} from "./types";

describe("guided evidence question contract", () => {
  it("requires employer need, explanation, and recall prompts", () => {
    const question = gapQuestionSchema.parse({
      id: "question-teamwork",
      prompt: "请回忆一次你协调团队完成任务的经历。",
      reason: "岗位要求团队管理经验。",
      employerNeed: "团队管理与协作",
      whyItMatters: "招聘方需要判断你能否推动多人共同完成目标。",
      possibleSources: ["学生会或社团", "课程项目", "竞赛团队", "志愿活动"],
      answerMode: "GUIDED_EXPERIENCE",
      targetPath: "experiences",
      required: false,
      issueIds: [],
    });

    expect(question.possibleSources).toContain("学生会或社团");
    expect(question.answerMode).toBe("GUIDED_EXPERIENCE");
  });

  it("rejects a question that gives no recall direction", () => {
    expect(() =>
      gapQuestionSchema.parse({
        id: "question-empty",
        prompt: "请补充经历。",
        reason: "证据不足。",
        employerNeed: "团队协作",
        whyItMatters: "岗位需要。",
        possibleSources: [],
        answerMode: "GUIDED_EXPERIENCE",
        targetPath: "experiences",
        required: false,
        issueIds: [],
      }),
    ).toThrow();
  });
});

describe("all-career resume contract", () => {
  it.each([
    "FREELANCE",
    "VOLUNTEER",
    "SELF_EMPLOYED",
    "PRACTICUM",
    "OTHER",
  ])("accepts %s as a real experience type", (type) => {
    const parsed = resumeDraftSchema.safeParse({
      basics: {
        name: "",
        phone: "",
        email: "",
        location: "",
        targetRole: "",
        summary: "",
      },
      education: [],
      experiences: [
        {
          id: "experience-1",
          organization: "",
          title: "",
          startDate: "",
          endDate: "",
          type,
          bullets: [],
        },
      ],
      projects: [],
      skills: [],
      certificates: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("uses profession-neutral template identifiers", () => {
    expect(templateIdSchema.options).toEqual([
      "EXPERIENCE",
      "PROFESSIONAL",
      "CAMPUS",
    ]);
  });
});

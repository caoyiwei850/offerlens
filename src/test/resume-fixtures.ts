import type { HiringSimulation } from "@/lib/analysis/types";
import type {
  Fact,
  ResumeDraft,
  ResumePlanResponse,
} from "@/lib/resume-workbench/types";
import {
  evaluationContext,
  evidenceAssessment,
} from "./hiring-fixtures";

export const analysisFixture: HiringSimulation = {
  evaluation_context: evaluationContext,
  flow: [
    { stage: "材料初筛", status: "PASS", reason: "材料通过。" },
    { stage: "硬性条件核验", status: "PASS", reason: "条件通过。" },
    { stage: "岗位能力匹配", status: "FAIL", reason: "策略规划证据不足。" },
    { stage: "经历证据评估", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
    { stage: "面试决策", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
  ],
  bottleneck_stage: "岗位能力匹配",
  bottleneck_reason: "策略规划证据不足。",
  final_result: "REJECT",
  improvements: ["补充策略案例", "量化项目成果", "准备项目复盘"],
  evidence_assessment: evidenceAssessment,
  passed_stage_count: 2,
  application_status: "REVISE_AND_APPLY",
};

export const resumeFacts: Fact[] = [
  { id: "source-001", text: "张三", source: "RESUME" },
  {
    id: "source-002",
    text: "负责用户增长项目策略执行",
    source: "RESUME",
  },
];

export const resumeDraft: ResumeDraft = {
  basics: {
    name: "张三",
    phone: "",
    email: "",
    location: "武汉",
    targetRole: "市场运营专员",
    summary: "具备市场运营项目经验。",
  },
  education: [],
  experiences: [
    {
      id: "experience-1",
      organization: "示例科技",
      title: "市场运营专员",
      startDate: "2021.07",
      endDate: "至今",
      type: "FULL_TIME",
      bullets: [
        {
          id: "bullet-1",
          text: "负责用户增长项目策略执行。",
          factRefs: ["source-002"],
          status: "SOURCE",
        },
      ],
    },
  ],
  projects: [],
  skills: ["市场调研", "数据分析"],
  certificates: [],
};

export const resumePlanFixture: ResumePlanResponse = {
  draft: resumeDraft,
  facts: resumeFacts,
  questions: [
    {
      id: "question-1",
      prompt: "用户增长项目带来了什么结果？",
      reason: "缺少可验证结果。",
      employerNeed: "能够说明项目结果",
      whyItMatters: "招聘方需要判断你的工作是否产生了实际影响。",
      possibleSources: ["实习项目", "课程项目", "竞赛作品", "工作复盘"],
      answerMode: "GUIDED_EXPERIENCE",
      targetPath: "experiences.0.bullets.0",
      required: true,
      issueIds: ["issue-1"],
    },
  ],
  issues: [
    {
      id: "issue-1",
      code: "MISSING_RESULT",
      severity: "WARNING",
      message: "用户增长项目缺少结果证据。",
      relatedPaths: ["experiences.0.bullets.0"],
      questionId: "question-1",
      resolved: false,
    },
  ],
  recommendedTemplate: "PROFESSIONAL",
  rewriteToken: "t".repeat(43),
};

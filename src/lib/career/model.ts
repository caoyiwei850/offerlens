import type { ReviewReport, InterviewPack } from "@/lib/workspace/types";

const REVIEW_SYSTEM_PROMPT = `你是独立简历评审员。
你只检查当前岗位、原始事实清单、用户补充事实和生成简历，不得创造新经历。

输出严格 JSON：
{
  "summary": "整体评审结论",
  "issues": [{
    "id": "issue-1",
    "type": "EVIDENCE_GAP",
    "severity": "WARNING",
    "location": "experiences.0.bullets.0",
    "reason": "为什么这是问题",
    "suggestion": "可执行修改建议",
    "safeAutoFix": false,
    "needsUserEvidence": true
  }],
  "safeRewriteNotes": ["只调整表达和结构的安全修改建议"]
}

type 只能是 EVIDENCE_GAP、OVERCLAIM、KEYWORD_MISSING、FACT_LINK_BROKEN、INTERVIEW_RISK、READABILITY。
severity 只能是 INFO、WARNING、BLOCKING。
涉及新增事实时 needsUserEvidence 必须为 true，safeAutoFix 必须为 false。
不要输出 Markdown。`;

const INTERVIEW_SYSTEM_PROMPT = `你是招聘方面试官和候选人面试准备教练。
基于岗位、当前简历版本、五维证据评测、卡点和二次评审报告生成追问准备包。
不得编造候选人经历，必须明确哪些材料不能编。

输出严格 JSON：
{
  "summary": "准备重点",
  "questions": [{
    "id": "question-1",
    "question": "可能被问的问题",
    "whyAsked": "为什么会问",
    "evidenceToPrepare": ["需要准备的真实材料"],
    "answerStructure": "建议回答结构",
    "fabricationBoundary": "不能编造的边界"
  }]
}

每个 WEAK/MISSING 证据维度至少覆盖一组追问；优先吸收二次评审中的面试风险。
不要输出 Offer 概率，不要输出 Markdown。`;

interface ModelOptions {
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

async function callJsonModel(
  system: string,
  input: unknown,
  { apiKey, fetcher = fetch, timeoutMs = 60_000 }: ModelOptions,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        max_tokens: 4_000,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`模型服务暂时不可用（${response.status}）`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("模型没有返回结果");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ReviewModelInput {
  jobDescription: string;
  analysis: unknown;
  resumeVersion: unknown;
  facts: unknown[];
}

export interface InterviewModelInput extends ReviewModelInput {
  reviewReports: ReviewReport[];
}

export function callReviewModel(
  input: ReviewModelInput,
  options: ModelOptions,
): Promise<string> {
  return callJsonModel(REVIEW_SYSTEM_PROMPT, input, options);
}

export function callInterviewPackModel(
  input: InterviewModelInput,
  options: ModelOptions,
): Promise<string> {
  return callJsonModel(INTERVIEW_SYSTEM_PROMPT, input, options);
}

export function buildFallbackReview(input: ReviewModelInput): ReviewReport {
  const draftText = JSON.stringify(input.resumeVersion);
  return {
    summary: "已完成基础二次评审。请优先核对事实引用、岗位关键词和可能被追问的薄弱证据。",
    issues: draftText.includes("NEEDS_INPUT")
      ? [
          {
            id: "review-needs-input",
            type: "EVIDENCE_GAP",
            severity: "WARNING",
            location: "简历待补充项",
            reason: "当前简历仍包含待补充内容，说明部分证据尚未确认。",
            suggestion: "回到事实确认环节补充真实材料，或删除无法证明的表述。",
            safeAutoFix: false,
            needsUserEvidence: true,
          },
        ]
      : [],
    safeRewriteNotes: ["可在不新增事实的前提下压缩冗长表达，突出与岗位描述直接相关的成果。"],
  };
}

export function buildFallbackInterviewPack(): InterviewPack {
  return {
    summary: "请围绕卡点和二次评审风险准备真实案例，避免把岗位要求倒写成个人经历。",
    questions: [
      {
        id: "interview-bottleneck",
        question: "请讲一个最能证明你匹配这个岗位核心要求的真实经历。",
        whyAsked: "招聘方会用这个问题核对简历证据是否能支撑岗位描述中的核心要求。",
        evidenceToPrepare: ["真实背景", "你的角色", "具体行动", "可核实结果"],
        answerStructure: "按背景、任务、行动、结果和复盘组织回答。",
        fabricationBoundary: "不要补充简历和事实清单中不存在的公司、项目、指标或职责。",
      },
    ],
  };
}

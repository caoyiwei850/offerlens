import type {
  EvidenceAnswer,
  Fact,
  GapQuestion,
  ResumeDraft,
} from "./types";

const PLAN_SYSTEM_PROMPT = `你是招聘负责人和简历证据编辑器。
你的任务是把现有简历整理成结构化草稿、识别缺口并提出追问，不得编造事实。
本系统适用于全部职业，不得套用技术岗或办公室岗位的固定写法。

规则：
- 只能使用输入 facts 中存在的事实。
- 工作和项目 bullet 必须携带至少一个有效 factRefs。
- 缺少结果、职责、工作性质或时间线证据时，保留原意并提出问题，不得自行补数字或经历。
- questions 最多 5 个，优先解决 BLOCKING 时间线和岗位关键证据。
- 每个 question 都必须说明 employerNeed、whyItMatters，并给出 2–6 个 possibleSources。
- possibleSources 只是帮助用户回忆的方向，不是候选人事实，绝不能写进 draft。
- possibleSources 必须与岗位实际所需的专业领域相关，不得套用固定模板。
- 必须使用 analysisSummary.evaluation_context 中的职业族和具体岗位来生成问题。
- 医护、驾驶等持证职业优先提示资质、培训、安全操作和真实服务案例；
  工程制造与建筑物流优先提示设备、工艺、质量、安全和现场执行；
  销售服务优先提示客户、成交、服务结果和现场处置；
  教育岗位优先提示教学设计、课堂实践、沟通和必要资质。
- 应届生和实习生优先从社团、班级、课程项目、毕业设计、竞赛、开源贡献、
  志愿活动和真实实习中寻找可迁移证据，不得要求其凭空补充多年全职经验。
- 团队管理可提示社团负责人、班委、项目组长、竞赛团队和活动组织；
  沟通协作可提示小组作业、跨专业项目、志愿服务和实习协作；
  数据分析可提示调研、实验、问卷、课程报告和真实运营后台；
  用户运营可提示社团招新、公众号、校园活动和志愿者管理；
  其他岗位类型应按实际专业领域匹配相应的校园或实习场景。
- 时间线、身份和经历性质核对使用 DIRECT_CONFIRMATION；
  能力与成果回忆使用 GUIDED_EXPERIENCE。
- skills 和 certificates 必须是纯字符串数组，例如 ["市场调研","数据分析"]，
  禁止输出 {"name":"市场调研"} 等对象；education.details 也必须是纯字符串数组。
- issue severity 只能是 WARNING 或 BLOCKING。
- BLOCKING 只用于事实互相矛盾，或不确认就会造成编造的核心时间线/经历性质；
  缺少可选指标、结果或表达证据只能标记 WARNING。
- 经历类型只能为 FULL_TIME、INTERNSHIP、PART_TIME、CAMPUS、FREELANCE、
  VOLUNTEER、SELF_EMPLOYED、PRACTICUM 或 OTHER。
- 模板只能为 EXPERIENCE、PROFESSIONAL 或 CAMPUS。
- 所有枚举必须原样输出英文大写值，不得翻译成中文。
- 在所有面向用户的文案（prompt、reason、employerNeed、whyItMatters、possibleSources、message）中，必须使用"岗位描述"而非"JD""岗位JD"等缩写。
- 输出严格 JSON，不要 Markdown 或额外文字。

输出结构：
{
  "draft": {
    "basics": {"name":"","phone":"","email":"","location":"","targetRole":"","summary":""},
    "education": [{"id":"education-1","school":"","degree":"","major":"","startDate":"","endDate":"","details":[]}],
    "experiences": [{"id":"experience-1","organization":"","title":"","startDate":"","endDate":"","type":"FULL_TIME","bullets":[{"id":"bullet-1","text":"","factRefs":["source-001"],"status":"SOURCE"}]}],
    "projects": [{"id":"project-1","name":"","role":"","startDate":"","endDate":"","bullets":[]}],
    "skills": ["市场调研", "数据分析"],
    "certificates": ["大学英语六级"]
  },
  "questions": [{
    "id":"question-1",
    "prompt":"请回忆一次你协调多人完成任务的真实经历。",
    "reason":"岗位描述要求团队管理经验，但当前简历缺少证据。",
    "employerNeed":"团队管理与协作",
    "whyItMatters":"招聘方需要判断你能否推动多人共同完成目标。",
    "possibleSources":["学生会或社团","课程项目","竞赛团队","志愿活动"],
    "answerMode":"GUIDED_EXPERIENCE",
    "targetPath":"experiences.0",
    "required":false,
    "issueIds":[]
  }],
  "issues": [{"id":"issue-1","code":"MISSING_RESULT","severity":"WARNING","message":"","relatedPaths":["experiences.0"],"questionId":"question-1","resolved":false}],
  "recommendedTemplate": "PROFESSIONAL"
}`;

const REWRITE_SYSTEM_PROMPT = `你是严格遵守事实的简历编辑器。
根据结构化草稿、事实清单和用户答案生成目标岗位简历。

规则：
- 不得添加事实清单中不存在的公司、学校、技能、职责、数据或成果。
- 每条工作和项目 bullet 必须引用至少一个有效 factRefs。
- 原事实使用 source-*，用户答案使用 answer-question-*。
- possibleSources、employerNeed、whyItMatters 和问题文案都不是事实，禁止写入简历。
- 只有 status 为 HAS_EVIDENCE 且已进入 facts 的用户回答可以写入简历。
- status 为 NO_EVIDENCE 或 UNSURE 的回答表示没有可用事实，禁止据此生成经历。
- 可以改善结构、动词和表达，但不能扩大职责或结果。
- 未解决的信息使用 NEEDS_INPUT，并在 unresolvedIssues 中保留。
- 已由用户答案解决的问题不得继续列为未解决。
- 每条 bullet 的 status 只能原样使用 SOURCE、AI_REWRITE、NEEDS_INPUT，
  不得输出“已改写”“待补充”等中文或其他值。
- unresolvedIssues 的 severity 只能原样使用 WARNING 或 BLOCKING，不得翻译。
- unresolvedIssues 必须是完整对象数组，禁止输出字符串数组；没有未解决问题时输出 []。
- 每个 unresolvedIssues 对象必须包含 id、code、severity、message、relatedPaths、resolved，
  questionId 仅在确有对应问题时提供；resolved 固定为 false。
- 在所有面向用户的文案（changeSummary、message）中，必须使用"岗位描述"而非"JD"等缩写。
- 输出严格 JSON，不要 Markdown 或额外文字。

输出结构：
{
  "draft": {
    "basics": {"name":"","phone":"","email":"","location":"","targetRole":"","summary":""},
    "education": [],
    "experiences": [
      {
        "id": "experience-1",
        "organization": "",
        "title": "",
        "startDate": "",
        "endDate": "",
        "type": "FULL_TIME",
        "bullets": [
          {
            "id": "bullet-1",
            "text": "",
            "factRefs": ["source-001"],
            "status": "AI_REWRITE"
          }
        ]
      }
    ],
    "projects": [
      {
        "id": "project-1",
        "name": "",
        "role": "",
        "startDate": "",
        "endDate": "",
        "bullets": [
          {
            "id": "bullet-2",
            "text": "",
            "factRefs": ["answer-question-1"],
            "status": "NEEDS_INPUT"
          }
        ]
      }
    ],
    "skills": [],
    "certificates": []
  },
  "changeSummary": ["将项目描述改为动作与结果结构"],
  "unresolvedIssues": [
    {
      "id": "issue-1",
      "code": "MISSING_RESULT",
      "severity": "WARNING",
      "message": "缺少可核实的结果证据",
      "relatedPaths": ["experiences.0.bullets.0"],
      "questionId": "question-1",
      "resolved": false
    }
  ]
}`;

interface ResumeModelOptions {
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

async function callJsonModel(
  system: string,
  user: string,
  {
    apiKey,
    fetcher = fetch,
    timeoutMs = 60_000,
  }: ResumeModelOptions,
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
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        max_tokens: 5_000,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`模型服务暂时不可用（${response.status}）`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("模型没有返回简历结果");
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("简历改写超时，请稍后重试");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface PlanModelInput {
  resumeText: string;
  jd: string;
  analysisSummary: unknown;
  facts: Fact[];
}

export function callResumePlanModel(
  input: PlanModelInput,
  options: ResumeModelOptions,
): Promise<string> {
  return callJsonModel(
    PLAN_SYSTEM_PROMPT,
    JSON.stringify(input),
    options,
  );
}

export interface RewriteModelInput {
  draft: ResumeDraft;
  facts: Fact[];
  questions: GapQuestion[];
  answers: EvidenceAnswer[];
  template: string;
}

export function callResumeRewriteModel(
  input: RewriteModelInput,
  options: ResumeModelOptions,
): Promise<string> {
  return callJsonModel(
    REWRITE_SYSTEM_PROMPT,
    JSON.stringify(input),
    options,
  );
}

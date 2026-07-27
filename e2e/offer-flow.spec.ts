import { expect, test, type Page } from "@playwright/test";

const rejectedEvidence = {
  summary: "关键词是首要卡点，但后续能力仍有可用证据。",
  dimensions: {
    keywordMatch: {
      level: "MISSING",
      reason: "JD 核心关键词证据缺失。",
      suggestion: "补充岗位要求中的高并发和分布式能力证据。",
    },
    basicQualification: {
      level: "SUFFICIENT",
      reason: "年限和基础条件证据充足。",
      suggestion: "明确相关岗位年限和职责范围。",
    },
    competencyFit: {
      level: "WEAK",
      reason: "技术能力相关，但深度证据有限。",
      suggestion: "补充系统设计取舍。",
    },
    experienceEvidence: {
      level: "WEAK",
      reason: "项目相关但结果证据偏弱。",
      suggestion: "补充项目规模和业务结果。",
    },
    interviewReadiness: {
      level: "WEAK",
      reason: "已有可表达素材，但结构仍需打磨。",
      suggestion: "准备结构化项目复盘。",
    },
  },
};

const passedEvidence = {
  summary: "五个维度均有充分招聘证据，可以进入针对性面试准备。",
  dimensions: Object.fromEntries(
    Object.entries(rejectedEvidence.dimensions).map(([key, dimension]) => [
      key,
      {
        ...dimension,
        level: "SUFFICIENT",
        reason: `${dimension.reason.replace(/缺失|有限|偏弱|仍需打磨/g, "充分")}`,
      },
    ]),
  ),
};

const simulation = {
  evaluation_context: {
    candidate_type: "FRESH_GRADUATE",
    job_track: "CAMPUS",
    occupation_family: "TECH_DIGITAL",
    occupation_name: "Java 后端工程师",
    occupation_source: "AUTO",
    basis: "简历显示为应届毕业生，岗位面向校招且未要求全职年限。",
  },
  flow: [
    { stage: "材料初筛", status: "FAIL", reason: "JD 核心关键词覆盖不足。" },
    { stage: "硬性条件核验", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
    { stage: "岗位能力匹配", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
    { stage: "经历证据评估", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
    { stage: "面试决策", status: "SKIPPED", reason: "因前序阶段未通过，未进入本阶段。" },
  ],
  bottleneck_stage: "材料初筛",
  bottleneck_reason: "JD 核心关键词覆盖不足。",
  final_result: "REJECT",
  improvements: [
    "补充一个包含业务约束和技术取舍的项目案例",
    "针对 JD 的高并发要求补充系统设计准备",
    "在简历中明确分布式组件与决策依据",
  ],
  evidence_assessment: rejectedEvidence,
  passed_stage_count: 0,
  application_status: "HOLD",
};

const passedSimulation = {
  evaluation_context: {
    candidate_type: "EXPERIENCED",
    job_track: "EXPERIENCED",
    occupation_family: "TECH_DIGITAL",
    occupation_name: "Java 后端工程师",
    occupation_source: "AUTO",
    basis: "简历包含连续全职经历，JD 明确要求三年以上相关经验。",
  },
  flow: [
    { stage: "材料初筛", status: "PASS", reason: "关键词覆盖充分。" },
    { stage: "硬性条件核验", status: "PASS", reason: "学历与年限满足要求。" },
    { stage: "岗位能力匹配", status: "PASS", reason: "核心岗位能力匹配。" },
    { stage: "经历证据评估", status: "PASS", reason: "项目证据充分。" },
    { stage: "面试决策", status: "PASS", reason: "材料支持进入面试。" },
  ],
  bottleneck_stage: "",
  bottleneck_reason: "",
  final_result: "PASS",
  improvements: [
    "准备项目架构图并说明关键取舍",
    "整理一次故障恢复案例及结果",
    "针对岗位场景准备系统设计表达",
  ],
  evidence_assessment: passedEvidence,
  passed_stage_count: 5,
  application_status: "STRETCH",
};

const workbenchDraft = {
  basics: {
    name: "张三",
    phone: "",
    email: "",
    location: "武汉",
    targetRole: "Java 后端工程师",
    summary: "具备后端项目经验。",
  },
  education: [],
  experiences: [
    {
      id: "experience-1",
      organization: "示例科技",
      title: "Java 后端工程师",
      startDate: "2021.07",
      endDate: "至今",
      type: "FULL_TIME",
      bullets: [
        {
          id: "bullet-1",
          text: "负责交易系统限流改造。",
          factRefs: ["source-001"],
          status: "SOURCE",
        },
      ],
    },
  ],
  projects: [],
  skills: ["Java", "Redis"],
  certificates: [],
};

async function mockComments(page: Page) {
  await page.route("**/api/comments**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "comment-e2e", status: "PENDING" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        comments: [],
        nextCursor: null,
        stats: { total: 0, averageRating: null },
      }),
    });
  });
}

test("submits post-interview feedback without rerunning an analysis", async ({
  page,
}) => {
  let analyzeRequests = 0;
  let feedbackPayload: Record<string, unknown> | null = null;
  page.on("request", (request) => {
    if (request.url().includes("/api/analyze")) analyzeRequests += 1;
  });
  await page.route("**/api/feedback", async (route) => {
    feedbackPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "feedback-e2e", status: "RECEIVED" }),
    });
  });

  await page.goto("/feedback");
  await expect(
    page.getByRole("heading", {
      name: "面试结束了？回来告诉我们真实结果",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "已获得 Offer" }).click();
  await page.getByRole("button", { name: "基本吻合" }).click();
  await page
    .getByLabel("反馈内容")
    .fill("实际面试重点与模拟判断吻合，不需要重新分析。");
  await page.getByRole("button", { name: "提交反馈" }).click();

  await expect(
    page.getByText("反馈已收到，谢谢你回来告诉我们真实结果。"),
  ).toBeVisible();
  expect(feedbackPayload).toMatchObject({
    kind: "INTERVIEW_OUTCOME",
    outcome: "OFFERED",
    predictionMatch: "MATCHED",
  });
  expect(analyzeRequests).toBe(0);
});

test("keeps all evidence dimensions after an early rejection and submits feedback", async ({
  page,
}) => {
  const analyticsEvents: Array<{ type?: string }> = [];
  await page.route("**/api/analytics", async (route) => {
    const body = route.request().postDataJSON() as { type?: string };
    analyticsEvents.push(body);
    await route.fulfill({ status: 202, body: "" });
  });
  await mockComments(page);
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...simulation, correction: null }),
    }),
  );

  await page.goto("/");
  await page.getByLabel("粘贴简历内容").fill("应届生，完成后端课程项目。");
  await page.getByLabel("目标岗位描述").fill("校招后端岗位，要求分布式项目证据。");
  await page.getByRole("button", { name: "开始模拟" }).click();

  await expect(page).toHaveURL(/\/result$/);
  await expect
    .poll(() => analyticsEvents.map((event) => event.type))
    .toEqual(
      expect.arrayContaining([
        "LANDING_VIEWED",
        "ANALYSIS_STARTED",
        "ANALYSIS_SUCCEEDED",
        "RESULT_VIEWED",
      ]),
    );
  await expect(page.getByText(/你被淘汰在：材料初筛/)).toBeVisible();
  await expect(page.getByText("SKIPPED · 未进入", { exact: true })).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "五维招聘证据评测" })).toBeVisible();
  await expect(page.getByText("面试表达素材")).toBeVisible();
  await expect(page.getByText("已有可表达素材，但结构仍需打磨。")).toBeVisible();
  await expect(page.getByText("暂缓投递")).toBeVisible();
  await expect(page.getByText("已通过 0/5 个招聘阶段")).toBeVisible();
  await page.reload();
  await expect(page.getByText("暂缓投递")).toBeVisible();

  await page.getByRole("button", { name: "4 星" }).click();
  await page.getByLabel("评论内容").fill("后续四维评测很有参考价值。");
  await page.getByRole("button", { name: "提交评价" }).click();
  await expect(page.getByText("评价已提交，审核通过后会公开显示")).toBeVisible();

  await page.getByRole("link", { name: "生成脱敏分享卡" }).click();
  await expect(page).toHaveURL(/\/share$/);
  await expect(page.getByText(/卡在/)).toBeVisible();
  await expect(page.getByText("已通过 0/5 个招聘阶段")).toBeVisible();
  await expect(page.getByText("投递建议：暂缓投递")).toBeVisible();
  await expect(
    page.getByText("未包含姓名、简历或完整岗位描述"),
  ).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 PNG" }).click();
  await expect(await download).toBeTruthy();
});

test("uploads a resume and preserves an all-pass stretch result", async ({
  page,
  context,
}) => {
  await mockComments(page);
  await page.route("**/api/resume/extract", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ resumeText: "五年后端经验，负责交易系统。" }),
    }),
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...passedSimulation, correction: null }),
    }),
  );

  await page.goto("/");
  await page.getByLabel("上传 PDF 或 DOCX 简历").setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 mocked resume"),
  });
  await page.getByLabel("目标岗位描述").fill("负责高并发交易系统的设计和交付。");
  await page.getByRole("button", { name: "开始模拟" }).click();

  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByRole("heading", { name: /准备迎接面试吧/ })).toBeVisible();
  await expect(page.getByText("PASS · 通过", { exact: true })).toHaveCount(5);
  await expect(page.getByText("建议冲刺")).toBeVisible();
  await page.reload();
  await expect(page.getByText("建议冲刺")).toBeVisible();

  await page.getByRole("link", { name: "生成脱敏分享卡" }).click();
  await expect(page.getByRole("heading", { name: "一张通过模拟筛选的卡片" })).toBeVisible();
  await page.getByRole("button", { name: "复制分享文案" }).click();
  await expect(page.getByText("分享文案已复制")).toBeVisible();
  const copiedText = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedText).toContain("模拟筛选已通过，可以准备面试了");
  expect(copiedText).toContain("已通过 5/5 个招聘阶段");
  expect(copiedText).toContain("投递建议：建议冲刺");
  expect(copiedText).toContain(new URL(page.url()).origin);
});

test("allows one free correction after automatic occupation classification", async ({
  page,
}) => {
  await mockComments(page);
  let calls = 0;
  let correctionRequest = "";
  await page.route("**/api/analyze", async (route) => {
    calls += 1;
    if (calls === 2) {
      correctionRequest = route.request().postData() ?? "";
    }
    const corrected =
      calls === 1
        ? simulation
        : {
            ...simulation,
            evaluation_context: {
              ...simulation.evaluation_context,
              occupation_family: "HEALTHCARE_CARE",
              occupation_name: "养老护理员",
              occupation_source: "USER_OVERRIDE",
            },
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...corrected,
        correction:
          calls === 1
            ? {
                token: "c".repeat(32),
                expires_at: "2099-01-01T00:00:00.000Z",
              }
            : null,
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("粘贴简历内容").fill("三年养老护理经历。");
  await page
    .getByLabel("目标岗位描述")
    .fill("养老护理员，要求照护培训和安全意识。");
  await page.getByRole("button", { name: "开始模拟" }).click();
  await page.getByRole("button", { name: "识别不准确？" }).click();
  await page
    .getByLabel("更正职业领域")
    .selectOption("HEALTHCARE_CARE");
  await page.getByRole("button", { name: "免费重新评测" }).click();

  await expect(
    page.getByText(/职业：医疗健康与照护 \/ 养老护理员/),
  ).toBeVisible();
  expect(calls).toBe(2);
  expect(correctionRequest).toContain("HEALTHCARE_CARE");
  expect(correctionRequest).toContain("c".repeat(32));
});

test("rewrites from verified facts, exports both formats, and reuses the JD", async ({
  page,
}) => {
  await mockComments(page);
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...simulation, correction: null }),
    }),
  );
  await page.route("**/api/resume/plan", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        draft: workbenchDraft,
        facts: [
          {
            id: "source-001",
            text: "负责交易系统限流改造",
            source: "RESUME",
          },
        ],
        questions: [
          {
            id: "question-1",
            prompt: "限流改造带来了什么结果？",
            reason: "缺少结果证据。",
            employerNeed: "能够说明项目结果",
            whyItMatters: "招聘方需要判断你的工作是否产生实际影响。",
            possibleSources: ["实习项目", "课程项目", "竞赛作品", "故障复盘"],
            answerMode: "GUIDED_EXPERIENCE",
            targetPath: "experiences.0.bullets.0",
            required: true,
            issueIds: [],
          },
        ],
        issues: [],
        recommendedTemplate: "PROFESSIONAL",
        rewriteToken: "t".repeat(43),
      }),
    }),
  );
  await page.route("**/api/resume/rewrite", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        draft: {
          ...workbenchDraft,
          experiences: [
            {
              ...workbenchDraft.experiences[0],
              bullets: [
                {
                  ...workbenchDraft.experiences[0].bullets[0],
                  text: "主导交易系统限流改造，提升高峰期稳定性。",
                  factRefs: ["source-001", "answer-question-1"],
                  status: "AI_REWRITE",
                },
              ],
            },
          ],
        },
        facts: [
          {
            id: "source-001",
            text: "负责交易系统限流改造",
            source: "RESUME",
          },
          {
            id: "answer-question-1",
            text: "提升高峰期稳定性",
            source: "ANSWER",
          },
        ],
        changeSummary: ["强化动作与结果表达。"],
        unresolvedIssues: [],
      }),
    }),
  );
  await page.route("**/api/resume/export?format=*", (route) => {
    const format = new URL(route.request().url()).searchParams.get("format");
    return route.fulfill({
      status: 200,
      contentType:
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      headers: {
        "content-disposition": `attachment; filename=resume.${format}`,
      },
      body: format === "pdf" ? "%PDF mocked" : "PK mocked",
    });
  });

  await page.goto("/");
  await page
    .getByLabel("粘贴简历内容")
    .fill("负责交易系统限流改造");
  await page.getByLabel("目标岗位描述").fill("Java 后端工程师");
  await page.getByRole("button", { name: "开始模拟" }).click();
  await page.getByRole("link", { name: "根据卡点改写简历" }).click();

  await page.getByRole("button", { name: "开始信息核对" }).click();
  await page.getByRole("button", { name: "我有类似经历" }).click();
  await page
    .getByLabel("请描述这段经历的背景、你的角色、具体行动和结果")
    .fill(
      "在交易系统限流改造中负责梳理核心链路并完善降级策略，最终提升高峰期稳定性。",
    );
  await page
    .getByRole("checkbox", { name: /我确认以上内容来自真实经历/ })
    .check();
  await page.getByRole("button", { name: "根据事实生成简历" }).click();
  await expect(page.locator("textarea").nth(2)).toHaveValue(
    "主导交易系统限流改造，提升高峰期稳定性。",
  );

  await page.getByRole("button", { name: "职业经历版" }).click();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 PDF" }).click();
  await pdfDownload;
  const docxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 DOCX" }).click();
  await docxDownload;

  await page.getByRole("button", { name: "用新版简历重新模拟" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("目标岗位描述")).toHaveValue("Java 后端工程师");
  await expect(page.getByLabel("粘贴简历内容")).toHaveValue(
    /主导交易系统限流改造/,
  );
});

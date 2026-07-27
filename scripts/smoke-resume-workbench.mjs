import { randomBytes } from "node:crypto";

const baseUrl = process.env.OFFERLENS_SMOKE_URL ?? "http://127.0.0.1:3001";
const ip = process.env.OFFERLENS_SMOKE_IP ?? "198.51.100.42";

const jd = `Java 后端工程师
要求本科及以上学历，熟悉 Java、Spring Boot、MySQL、Redis 和消息队列；
具备高并发系统、故障治理和跨团队协作经验，能够清晰说明项目取舍与结果。`;

const samples = [
  {
    label: "normal",
    resume: `李明
男，24岁，本科，Java 后端工程师

教育经历
武汉理工大学，计算机科学与技术，本科，2020.09—2024.06

实习经历
武汉示例科技有限公司，Java 后端实习生，2023.07—2024.05
参与订单服务开发，使用 Spring Boot、MySQL 和 Redis。
在导师指导下完善慢查询监控，将核心接口平均响应时间从 280ms 降至 190ms。

项目经历
校园二手交易平台，后端负责人，2023.03—2023.06
使用 Java、Spring Boot、MySQL、Redis 完成商品、订单和用户模块。
通过库存校验与幂等设计处理重复提交问题，并完成压力测试与故障复盘。

技能
Java、Spring Boot、MySQL、Redis、Git、Linux`,
  },
  {
    label: "contradictory",
    resume: `张三
男，23岁，大学本科
个人简介：大学刚毕业。

工作经历
深圳市蓝海优品科技有限公司，电商运营主管，2021.04—至今
负责天猫、京东店铺运营，操作直通车和引力魔方，月度推广预算5-15万元。

武汉市锦程电子商务有限公司，电商运营专员，2019.08—2021.03
负责天猫、淘宝店铺日常运营与大促执行。`,
  },
];

function identity() {
  return {
    deviceId: randomBytes(32).toString("hex"),
    fingerprint: randomBytes(32).toString("hex"),
  };
}

async function readJson(response, label) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${label}: ${response.status} ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`${label}: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function analyze(sample, device) {
  const form = new FormData();
  form.set("resumeText", sample.resume);
  form.set("jd", jd);
  form.set("deviceId", device.deviceId);
  form.set("fingerprint", device.fingerprint);
  const response = await readJson(
    await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        cookie: `offerlens_device_id=${device.deviceId}`,
        "x-real-ip": ip,
      },
      body: form,
    }),
    `${sample.label}/analyze`,
  );
  delete response.correction;
  return response;
}

async function plan(sample, analysis, device) {
  return readJson(
    await fetch(`${baseUrl}/api/resume/plan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `offerlens_device_id=${device.deviceId}`,
        "x-real-ip": ip,
      },
      body: JSON.stringify({
        resumeText: sample.resume,
        jd,
        analysis,
        ...device,
      }),
    }),
    `${sample.label}/plan`,
  );
}

async function rewrite(sample, planResult, device) {
  const request = {
    draft: planResult.draft,
    facts: planResult.facts,
    questions: planResult.questions,
    answers: planResult.questions.map((question) => ({
      questionId: question.id,
      status: "HAS_EVIDENCE",
      detail:
        "在校园二手交易平台担任后端负责人，使用 Java、Spring Boot、MySQL 和 Redis 完成商品、订单和用户模块，并完成压力测试与故障复盘。",
    })),
    issues: planResult.issues.map((issue) => ({
      ...issue,
      resolved: issue.severity === "WARNING",
    })),
    template: planResult.recommendedTemplate,
    rewriteToken: planResult.rewriteToken,
    factsConfirmed: true,
    ...device,
  };
  const response = await fetch(`${baseUrl}/api/resume/rewrite`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `offerlens_device_id=${device.deviceId}`,
      "x-real-ip": ip,
    },
    body: JSON.stringify(request),
  });
  const result = await readJson(response, `${sample.label}/rewrite`);

  const replay = await fetch(`${baseUrl}/api/resume/rewrite`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `offerlens_device_id=${device.deviceId}`,
      "x-real-ip": ip,
    },
    body: JSON.stringify(request),
  });
  if (replay.status !== 409) {
    throw new Error(
      `${sample.label}/token-replay: expected 409, received ${replay.status}`,
    );
  }
  return result;
}

for (const sample of samples) {
  const device = identity();
  const analysis = await analyze(sample, device);
  const planResult = await plan(sample, analysis, device);
  console.log(
    JSON.stringify({
      sample: sample.label,
      applicationStatus: analysis.application_status,
      passedStages: analysis.passed_stage_count,
      questions: planResult.questions.length,
      blockingIssues: planResult.issues.filter(
        (issue) => issue.severity === "BLOCKING",
      ).length,
      template: planResult.recommendedTemplate,
      guidance: planResult.questions.map((question) => ({
        need: question.employerNeed,
        mode: question.answerMode,
        sources: question.possibleSources,
      })),
    }),
  );
  if (sample.label === "normal") {
    const rewriteResult = await rewrite(sample, planResult, device);
    console.log(
      JSON.stringify({
        sample: sample.label,
        rewritten: true,
        changes: rewriteResult.changeSummary.length,
        unresolvedIssues: rewriteResult.unresolvedIssues.length,
        tokenReplayBlocked: true,
      }),
    );
  }
}

import { redisResumeAccessStore } from "@/lib/access/redis-store";
import {
  checkResumePlanAccess,
  hashResumeDevice,
  issueRewriteToken,
  type ResumeAccessDecision,
  type ResumeAccessIdentity,
  type ResumeAccessStore,
} from "@/lib/resume-workbench/access";
import {
  detectDeterministicIssues,
  mergeConsistencyIssues,
} from "@/lib/resume-workbench/consistency";
import {
  buildSourceFacts,
  validateDraftFacts,
} from "@/lib/resume-workbench/facts";
import { buildGuidedQuestionSet } from "@/lib/resume-workbench/guidance";
import {
  callResumePlanModel,
  type PlanModelInput,
} from "@/lib/resume-workbench/model";
import {
  apiError,
  readCookie,
  summarizeResumeError,
} from "@/lib/resume-workbench/route-utils";
import {
  resumePlanModelSchema,
  resumePlanRequestSchema,
} from "@/lib/resume-workbench/types";
import { normalizeResumeModelOutput } from "@/lib/resume-workbench/normalize-model-output";

export const runtime = "nodejs";

const RATE_LIMIT_MESSAGES = {
  cooldown: "操作太快，请稍后重试",
  ip: "当前网络请求过于频繁，请稍后再试",
  device: "今天这台设备的简历规划次数已用完",
  global: "今日全站简历规划次数已用完",
} as const;

interface PlanDependencies {
  accessStore: ResumeAccessStore;
  checkAccess: (
    identity: ResumeAccessIdentity,
    store: ResumeAccessStore,
  ) => Promise<ResumeAccessDecision>;
  callModel: (input: PlanModelInput) => Promise<string>;
}

export function createResumePlanHandler(dependencies: PlanDependencies) {
  return async function handlePlan(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_INPUT", "请求格式无效");
    }
    const parsed = resumePlanRequestSchema.safeParse(body);
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "简历工作区数据无效");
    if (
      readCookie(request, "offerlens_device_id") !== parsed.data.deviceId
    ) {
      return apiError(400, "INVALID_DEVICE", "设备标识无效，请刷新后重试");
    }
    const ip = request.headers.get("x-real-ip")?.trim();
    if (!ip && process.env.NODE_ENV === "production") {
      return apiError(503, "WORKBENCH_UNAVAILABLE", "简历工作台暂时不可用");
    }

    let decision: ResumeAccessDecision;
    try {
      decision = await dependencies.checkAccess(
        {
          ip: ip || "127.0.0.1",
          deviceId: parsed.data.deviceId,
          fingerprint: parsed.data.fingerprint,
        },
        dependencies.accessStore,
      );
    } catch {
      return apiError(503, "WORKBENCH_UNAVAILABLE", "简历工作台暂时不可用");
    }
    if (!decision.allowed) {
      return apiError(
        429,
        "RATE_LIMITED",
        RATE_LIMIT_MESSAGES[decision.reason],
        decision.retryAfter,
      );
    }

    const facts = buildSourceFacts(parsed.data.resumeText);
    try {
      const raw = await dependencies.callModel({
        resumeText: parsed.data.resumeText,
        jd: parsed.data.jd,
        analysisSummary: {
          evaluation_context: parsed.data.analysis.evaluation_context,
          bottleneck_stage: parsed.data.analysis.bottleneck_stage,
          bottleneck_reason: parsed.data.analysis.bottleneck_reason,
          application_status: parsed.data.analysis.application_status,
          evidence_assessment: parsed.data.analysis.evidence_assessment,
          improvements: parsed.data.analysis.improvements,
        },
        facts,
      });
      const plan = resumePlanModelSchema.parse(
        normalizeResumeModelOutput(JSON.parse(raw)),
      );
      validateDraftFacts(plan.draft, facts);
      const issues = mergeConsistencyIssues(
        detectDeterministicIssues(
          parsed.data.resumeText,
          plan.draft.experiences,
        ),
        plan.issues,
      );
      const guided = buildGuidedQuestionSet({
        questions: plan.questions,
        issues,
      });
      const rewriteToken = await issueRewriteToken(
        hashResumeDevice(parsed.data.deviceId, parsed.data.fingerprint),
        dependencies.accessStore,
      );
      return Response.json(
        {
          ...plan,
          questions: guided.questions,
          issues: guided.issues,
          facts,
          rewriteToken,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error(
        "[resume-plan] invalid model response",
        summarizeResumeError(error),
      );
      return apiError(
        502,
        "INVALID_MODEL_RESPONSE",
        "AI 未能生成可信的简历规划，请重试",
      );
    }
  };
}

export function POST(request: Request): Promise<Response> {
  return createResumePlanHandler({
    accessStore: redisResumeAccessStore,
    checkAccess: checkResumePlanAccess,
    callModel: (input) =>
      callResumePlanModel(input, {
        apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      }),
  })(request);
}

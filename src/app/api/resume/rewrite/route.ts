import { redisResumeAccessStore } from "@/lib/access/redis-store";
import {
  consumeRewriteToken,
  hashResumeDevice,
  type ResumeAccessStore,
} from "@/lib/resume-workbench/access";
import {
  appendEvidenceAnswerFacts,
  validateDraftFacts,
} from "@/lib/resume-workbench/facts";
import {
  completedQuestionIds,
  resolveIssuesFromAnswers,
} from "@/lib/resume-workbench/guidance";
import {
  callResumeRewriteModel,
  type RewriteModelInput,
} from "@/lib/resume-workbench/model";
import {
  apiError,
  readCookie,
  summarizeResumeError,
} from "@/lib/resume-workbench/route-utils";
import {
  resumeRewriteModelSchema,
  resumeRewriteRequestSchema,
} from "@/lib/resume-workbench/types";
import { normalizeResumeModelOutput } from "@/lib/resume-workbench/normalize-model-output";

export const runtime = "nodejs";

interface RewriteDependencies {
  accessStore: ResumeAccessStore;
  callModel: (input: RewriteModelInput) => Promise<string>;
}

export function createResumeRewriteHandler(dependencies: RewriteDependencies) {
  return async function handleRewrite(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_INPUT", "请求格式无效");
    }
    const parsed = resumeRewriteRequestSchema.safeParse(body);
    if (!parsed.success) {
      const answerTooLong = parsed.error.issues.some(
        (issue) =>
          issue.path[0] === "answers" &&
          (issue.code === "too_big" || /不能超过/.test(issue.message)),
      );
      if (answerTooLong) {
        return apiError(
          400,
          "ANSWER_TOO_LONG",
          "单项补充内容不能超过允许长度",
        );
      }
      const answerMissing = parsed.error.issues.some(
        (issue) =>
          issue.path[0] === "answers" &&
          /请填写真实经历/.test(issue.message),
      );
      if (answerMissing) {
        return apiError(400, "MISSING_ANSWERS", "还有必填信息没有补充");
      }
      const factsNotConfirmed =
        typeof body === "object" &&
        body !== null &&
        "factsConfirmed" in body &&
        body.factsConfirmed === false;
      if (factsNotConfirmed) {
        return apiError(
          400,
          "FACTS_NOT_CONFIRMED",
          "请确认补充内容来自真实经历",
        );
      }
      console.error(
        "[resume-rewrite] invalid request",
        summarizeResumeError(parsed.error),
      );
      return apiError(
        400,
        "STALE_WORKBENCH",
        "当前改写会话已失效，请重新生成核对清单",
      );
    }
    if (
      readCookie(request, "offerlens_device_id") !== parsed.data.deviceId
    ) {
      return apiError(400, "INVALID_DEVICE", "设备标识无效，请刷新后重试");
    }

    const answered = completedQuestionIds(
      parsed.data.questions,
      parsed.data.answers,
    );
    if (
      parsed.data.questions.some(
        (question) => question.required && !answered.has(question.id),
      )
    ) {
      return apiError(400, "MISSING_ANSWERS", "还有必填信息没有补充");
    }
    const resolvedIssues = resolveIssuesFromAnswers(
      parsed.data.issues,
      parsed.data.questions,
      parsed.data.answers,
    );
    if (
      resolvedIssues.some(
        (issue) => issue.severity === "BLOCKING" && !issue.resolved,
      )
    ) {
      return apiError(
        400,
        "UNRESOLVED_CONFLICT",
        "还有关键信息没有说明清楚",
      );
    }
    const deviceHash = hashResumeDevice(
      parsed.data.deviceId,
      parsed.data.fingerprint,
    );
    let tokenAccepted: boolean;
    try {
      tokenAccepted = await consumeRewriteToken(
        parsed.data.rewriteToken,
        deviceHash,
        dependencies.accessStore,
      );
    } catch {
      return apiError(503, "WORKBENCH_UNAVAILABLE", "简历工作台暂时不可用");
    }
    if (!tokenAccepted) {
      return apiError(409, "TOKEN_EXPIRED", "改写会话已失效，请重新生成规划");
    }

    const facts = appendEvidenceAnswerFacts(
      parsed.data.facts,
      parsed.data.answers,
    );
    try {
      const raw = await dependencies.callModel({
        draft: parsed.data.draft,
        facts,
        questions: parsed.data.questions,
        answers: parsed.data.answers,
        template: parsed.data.template,
      });
      const rewritten = resumeRewriteModelSchema.parse(
        normalizeResumeModelOutput(JSON.parse(raw)),
      );
      validateDraftFacts(rewritten.draft, facts);
      const answeredIssueIds = new Set(
        parsed.data.questions
          .filter((question) => answered.has(question.id))
          .flatMap((question) => question.issueIds),
      );
      const carriedIssues = resolvedIssues.filter(
        (issue) =>
          !issue.resolved &&
          !answeredIssueIds.has(issue.id) &&
          !rewritten.unresolvedIssues.some((item) => item.id === issue.id),
      );
      return Response.json(
        {
          ...rewritten,
          unresolvedIssues: [...carriedIssues, ...rewritten.unresolvedIssues],
          facts,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error(
        "[resume-rewrite] invalid model response",
        summarizeResumeError(error),
      );
      return apiError(
        502,
        "INVALID_MODEL_RESPONSE",
        "AI 未能生成可信的简历，请重新规划",
      );
    }
  };
}

export function POST(request: Request): Promise<Response> {
  return createResumeRewriteHandler({
    accessStore: redisResumeAccessStore,
    callModel: (input) =>
      callResumeRewriteModel(input, {
        apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      }),
  })(request);
}

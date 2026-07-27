import { redisCommentRateLimitStore } from "@/lib/access/redis-store";
import {
  checkFeedbackAccess,
  type FeedbackAccessDecision,
  type FeedbackAccessIdentity,
} from "@/lib/feedback/access";
import { isFeedbackAdminAuthorized } from "@/lib/feedback/admin-auth";
import type { FeedbackRepository } from "@/lib/feedback/repository";
import { getFeedbackRepository } from "@/lib/feedback/repository-instance";
import {
  feedbackAdminQuerySchema,
  feedbackSubmissionSchema,
} from "@/lib/feedback/types";

export const runtime = "nodejs";

interface FeedbackRouteDependencies {
  repository: FeedbackRepository;
  adminToken: string;
  checkAccess: (
    identity: FeedbackAccessIdentity,
  ) => Promise<FeedbackAccessDecision>;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  retryAfter?: number,
): Response {
  return Response.json(
    { error: { code, message, ...(retryAfter ? { retryAfter } : {}) } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}

function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function createFeedbackHandlers(
  dependencies: FeedbackRouteDependencies,
) {
  return {
    GET(request: Request): Response {
      if (!isFeedbackAdminAuthorized(request, dependencies.adminToken)) {
        return errorResponse(401, "UNAUTHORIZED", "管理员令牌无效");
      }
      const parsed = feedbackAdminQuerySchema.safeParse({
        limit: new URL(request.url).searchParams.get("limit") || undefined,
      });
      if (!parsed.success) {
        return errorResponse(400, "INVALID_INPUT", "反馈列表参数无效");
      }
      try {
        return Response.json(
          { feedback: dependencies.repository.listRecent(parsed.data.limit) },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return errorResponse(503, "FEEDBACK_UNAVAILABLE", "反馈暂时无法加载");
      }
    },

    async POST(request: Request): Promise<Response> {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errorResponse(400, "INVALID_INPUT", "请求格式无效");
      }
      const parsed = feedbackSubmissionSchema.safeParse(body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0]?.message;
        return errorResponse(
          400,
          "INVALID_INPUT",
          issue || "反馈内容无效",
        );
      }
      if (
        readCookie(request, "offerlens_device_id") !== parsed.data.deviceId
      ) {
        return errorResponse(
          400,
          "INVALID_DEVICE",
          "设备标识无效，请刷新后重试",
        );
      }
      const ip = request.headers.get("x-real-ip")?.trim();
      if (!ip && process.env.NODE_ENV === "production") {
        return errorResponse(
          503,
          "FEEDBACK_UNAVAILABLE",
          "反馈服务暂时不可用",
        );
      }

      let decision: FeedbackAccessDecision;
      try {
        decision = await dependencies.checkAccess({
          ip: ip || "127.0.0.1",
          deviceId: parsed.data.deviceId,
          fingerprint: parsed.data.fingerprint,
        });
      } catch {
        return errorResponse(
          503,
          "FEEDBACK_UNAVAILABLE",
          "反馈服务暂时不可用",
        );
      }
      if (!decision.allowed) {
        return errorResponse(
          429,
          "RATE_LIMITED",
          decision.reason === "cooldown"
            ? "提交太快，请稍后再试"
            : "今日反馈次数已用完",
          decision.retryAfter,
        );
      }

      try {
        return Response.json(
          dependencies.repository.create({
            kind: parsed.data.kind,
            outcome: parsed.data.outcome,
            predictionMatch: parsed.data.predictionMatch,
            rating: parsed.data.rating,
            content: parsed.data.content,
            occupationFamily: parsed.data.occupationFamily,
            deviceHash: decision.deviceHash,
            ipHash: decision.ipHash,
          }),
          {
            status: 201,
            headers: { "Cache-Control": "no-store" },
          },
        );
      } catch {
        return errorResponse(
          503,
          "FEEDBACK_UNAVAILABLE",
          "反馈提交失败，请稍后重试",
        );
      }
    },
  };
}

function defaultHandlers() {
  return createFeedbackHandlers({
    repository: getFeedbackRepository(),
    adminToken: process.env.FEEDBACK_ADMIN_TOKEN ?? "",
    checkAccess: (identity) =>
      checkFeedbackAccess(
        identity,
        process.env.FEEDBACK_HASH_SECRET ?? "",
        redisCommentRateLimitStore,
      ),
  });
}

export function GET(request: Request): Response {
  return defaultHandlers().GET(request);
}

export function POST(request: Request): Promise<Response> {
  return defaultHandlers().POST(request);
}

import { redisCommentRateLimitStore } from "@/lib/access/redis-store";
import {
  checkCommentAccess,
  type CommentAccessDecision,
  type CommentAccessIdentity,
} from "@/lib/comments/access";
import type { CommentRepository } from "@/lib/comments/repository";
import { getCommentRepository } from "@/lib/comments/repository-instance";
import {
  commentQuerySchema,
  commentSubmissionSchema,
} from "@/lib/comments/types";

export const runtime = "nodejs";

interface CommentRouteDependencies {
  repository: CommentRepository;
  checkAccess: (
    identity: CommentAccessIdentity,
  ) => Promise<CommentAccessDecision>;
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
    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }
  return undefined;
}

export function createCommentsHandlers(dependencies: CommentRouteDependencies) {
  return {
    GET(request: Request): Response {
      const url = new URL(request.url);
      const query = commentQuerySchema.safeParse({
        cursor: url.searchParams.get("cursor") || undefined,
        limit: url.searchParams.get("limit") || undefined,
      });
      if (!query.success) {
        return errorResponse(400, "INVALID_INPUT", "评论分页参数无效");
      }
      try {
        return Response.json(dependencies.repository.list(query.data), {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (error) {
        if (error instanceof Error && error.message === "评论游标无效") {
          return errorResponse(400, "INVALID_INPUT", error.message);
        }
        return errorResponse(503, "COMMENTS_UNAVAILABLE", "评论暂时无法加载");
      }
    },

    async POST(request: Request): Promise<Response> {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errorResponse(400, "INVALID_INPUT", "请求格式无效");
      }
      const parsed = commentSubmissionSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(400, "INVALID_INPUT", "评论内容无效");
      }

      const cookieDeviceId = readCookie(request, "offerlens_device_id");
      if (cookieDeviceId !== parsed.data.deviceId) {
        return errorResponse(400, "INVALID_DEVICE", "设备标识无效，请刷新后重试");
      }
      const ip = request.headers.get("x-real-ip")?.trim();
      if (!ip && process.env.NODE_ENV === "production") {
        return errorResponse(503, "COMMENTS_UNAVAILABLE", "评论服务暂时不可用");
      }

      let decision: CommentAccessDecision;
      try {
        decision = await dependencies.checkAccess({
          ip: ip || "127.0.0.1",
          deviceId: parsed.data.deviceId,
          fingerprint: parsed.data.fingerprint,
        });
      } catch {
        return errorResponse(503, "COMMENTS_UNAVAILABLE", "评论服务暂时不可用");
      }
      if (!decision.allowed) {
        return errorResponse(
          429,
          "RATE_LIMITED",
          decision.reason === "cooldown"
            ? "评论提交太快，请稍后再试"
            : "今日评论次数已用完",
          decision.retryAfter,
        );
      }

      try {
        const comment = dependencies.repository.create({
          nickname: parsed.data.nickname,
          rating: parsed.data.rating,
          content: parsed.data.content,
          deviceHash: decision.deviceHash,
          ipHash: decision.ipHash,
        });
        return Response.json(comment, {
          status: 201,
          headers: { "Cache-Control": "no-store" },
        });
      } catch {
        return errorResponse(503, "COMMENTS_UNAVAILABLE", "评论提交失败，请稍后重试");
      }
    },
  };
}

function defaultHandlers() {
  return createCommentsHandlers({
    repository: getCommentRepository(),
    checkAccess: (identity) =>
      checkCommentAccess(
        identity,
        process.env.COMMENT_HASH_SECRET ?? "",
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

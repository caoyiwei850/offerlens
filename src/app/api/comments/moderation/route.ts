import { isCommentAdminAuthorized } from "@/lib/comments/admin-auth";
import type { CommentRepository } from "@/lib/comments/repository";
import { getCommentRepository } from "@/lib/comments/repository-instance";

export const runtime = "nodejs";

interface ModerationQueueDependencies {
  repository: CommentRepository;
  adminToken: string;
}

export function createModerationQueueHandler({
  repository,
  adminToken,
}: ModerationQueueDependencies) {
  return function getModerationQueue(request: Request): Response {
    if (!adminToken) {
      return Response.json(
        { error: { code: "COMMENTS_UNAVAILABLE", message: "评论管理未配置" } },
        { status: 503 },
      );
    }
    if (!isCommentAdminAuthorized(request, adminToken)) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "管理员令牌无效" } },
        { status: 401 },
      );
    }

    const rawLimit = new URL(request.url).searchParams.get("limit") ?? "50";
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "待审列表参数无效" } },
        { status: 400 },
      );
    }

    try {
      return Response.json(
        { comments: repository.listPending(limit) },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return Response.json(
        { error: { code: "COMMENTS_UNAVAILABLE", message: "待审评论暂时无法加载" } },
        { status: 503 },
      );
    }
  };
}

export function GET(request: Request): Response {
  return createModerationQueueHandler({
    repository: getCommentRepository(),
    adminToken: process.env.COMMENT_ADMIN_TOKEN ?? "",
  })(request);
}

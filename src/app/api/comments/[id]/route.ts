import { isCommentAdminAuthorized } from "@/lib/comments/admin-auth";
import type { CommentRepository } from "@/lib/comments/repository";
import { getCommentRepository } from "@/lib/comments/repository-instance";
import type { ModerationDecision } from "@/lib/comments/types";

export const runtime = "nodejs";

interface DeleteCommentDependencies {
  repository: CommentRepository;
  adminToken: string;
}

type CommentAdminDependencies = DeleteCommentDependencies;

function authorize(
  request: Request,
  id: string,
  adminToken: string,
): Response | null {
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
  if (!id || id.length > 100) {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "评论 ID 无效" } },
      { status: 400 },
    );
  }
  return null;
}

export function createDeleteCommentHandler({
  repository,
  adminToken,
}: DeleteCommentDependencies) {
  return async function deleteComment(request: Request, id: string): Promise<Response> {
    const authorizationError = authorize(request, id, adminToken);
    if (authorizationError) return authorizationError;

    try {
      if (!repository.softDelete(id)) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: "评论不存在" } },
          { status: 404 },
        );
      }
      return new Response(null, { status: 204 });
    } catch {
      return Response.json(
        { error: { code: "COMMENTS_UNAVAILABLE", message: "评论删除失败" } },
        { status: 503 },
      );
    }
  };
}

export function createModerateCommentHandler({
  repository,
  adminToken,
}: CommentAdminDependencies) {
  return async function moderateComment(request: Request, id: string): Promise<Response> {
    const authorizationError = authorize(request, id, adminToken);
    if (authorizationError) return authorizationError;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "审核状态无效" } },
        { status: 400 },
      );
    }
    const status =
      typeof body === "object" && body !== null && "status" in body
        ? (body as { status?: unknown }).status
        : undefined;
    if (status !== "APPROVED" && status !== "REJECTED") {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "审核状态无效" } },
        { status: 400 },
      );
    }

    try {
      if (!repository.moderate(id, status as ModerationDecision)) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: "评论不存在" } },
          { status: 404 },
        );
      }
      return Response.json(
        { id, status },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return Response.json(
        { error: { code: "COMMENTS_UNAVAILABLE", message: "评论审核失败" } },
        { status: 503 },
      );
    }
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return createModerateCommentHandler({
    repository: getCommentRepository(),
    adminToken: process.env.COMMENT_ADMIN_TOKEN ?? "",
  })(request, id);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return createDeleteCommentHandler({
    repository: getCommentRepository(),
    adminToken: process.env.COMMENT_ADMIN_TOKEN ?? "",
  })(request, id);
}

// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  createDeleteCommentHandler,
  createModerateCommentHandler,
} from "./route";
import type { CommentRepository } from "@/lib/comments/repository";

function makeRepository(deleted = true): CommentRepository {
  return {
    create: vi.fn(),
    list: vi.fn(),
    listPending: vi.fn(),
    moderate: vi.fn(() => deleted),
    softDelete: vi.fn(() => deleted),
    close: vi.fn(),
  };
}

describe("DELETE /api/comments/[id]", () => {
  it("soft deletes a comment with the administrator token", async () => {
    const repository = makeRepository();
    const handler = createDeleteCommentHandler({
      repository,
      adminToken: "admin-secret",
    });

    const response = await handler(
      new Request("http://localhost/api/comments/comment-1", {
        method: "DELETE",
        headers: { authorization: "Bearer admin-secret" },
      }),
      "comment-1",
    );

    expect(response.status).toBe(204);
    expect(repository.softDelete).toHaveBeenCalledWith("comment-1");
  });

  it("rejects an invalid administrator token", async () => {
    const repository = makeRepository();
    const handler = createDeleteCommentHandler({
      repository,
      adminToken: "admin-secret",
    });

    const response = await handler(
      new Request("http://localhost/api/comments/comment-1", {
        method: "DELETE",
        headers: { authorization: "Bearer wrong" },
      }),
      "comment-1",
    );

    expect(response.status).toBe(401);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when the visible comment does not exist", async () => {
    const handler = createDeleteCommentHandler({
      repository: makeRepository(false),
      adminToken: "admin-secret",
    });

    const response = await handler(
      new Request("http://localhost/api/comments/missing", {
        method: "DELETE",
        headers: { authorization: "Bearer admin-secret" },
      }),
      "missing",
    );

    expect(response.status).toBe(404);
  });

  it("fails closed when the administrator token is not configured", async () => {
    const handler = createDeleteCommentHandler({
      repository: makeRepository(),
      adminToken: "",
    });

    const response = await handler(
      new Request("http://localhost/api/comments/comment-1", {
        method: "DELETE",
        headers: { authorization: "Bearer anything" },
      }),
      "comment-1",
    );

    expect(response.status).toBe(503);
  });
});

describe("PATCH /api/comments/[id]", () => {
  it("approves a pending comment with the administrator token", async () => {
    const repository = makeRepository();
    const handler = createModerateCommentHandler({
      repository,
      adminToken: "admin-secret",
    });

    const response = await handler(
      new Request("http://localhost/api/comments/comment-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer admin-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "APPROVED" }),
      }),
      "comment-1",
    );

    expect(response.status).toBe(200);
    expect(repository.moderate).toHaveBeenCalledWith("comment-1", "APPROVED");
    await expect(response.json()).resolves.toEqual({
      id: "comment-1",
      status: "APPROVED",
    });
  });

  it("rejects an unsupported moderation state", async () => {
    const repository = makeRepository();
    const handler = createModerateCommentHandler({
      repository,
      adminToken: "admin-secret",
    });

    const response = await handler(
      new Request("http://localhost/api/comments/comment-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer admin-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "PENDING" }),
      }),
      "comment-1",
    );

    expect(response.status).toBe(400);
    expect(repository.moderate).not.toHaveBeenCalled();
  });
});

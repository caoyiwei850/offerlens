// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createModerationQueueHandler } from "./route";
import type { CommentRepository } from "@/lib/comments/repository";

function makeRepository(): CommentRepository {
  return {
    create: vi.fn(),
    list: vi.fn(),
    listPending: vi.fn(() => [
      {
        id: "comment-1",
        nickname: "匿名用户",
        rating: 5,
        content: "待审核评价",
        createdAt: "2026-07-02T00:00:00.000Z",
        status: "PENDING" as const,
      },
    ]),
    moderate: vi.fn(),
    softDelete: vi.fn(),
    close: vi.fn(),
  };
}

describe("GET /api/comments/moderation", () => {
  it("returns the pending queue to an administrator", async () => {
    const repository = makeRepository();
    const handler = createModerationQueueHandler({
      repository,
      adminToken: "admin-secret",
    });

    const response = handler(
      new Request("http://localhost/api/comments/moderation?limit=50", {
        headers: { authorization: "Bearer admin-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(repository.listPending).toHaveBeenCalledWith(50);
    await expect(response.json()).resolves.toMatchObject({
      comments: [{ id: "comment-1", status: "PENDING" }],
    });
  });

  it("does not reveal pending comments without the administrator token", () => {
    const repository = makeRepository();
    const handler = createModerationQueueHandler({
      repository,
      adminToken: "admin-secret",
    });

    const response = handler(
      new Request("http://localhost/api/comments/moderation"),
    );

    expect(response.status).toBe(401);
    expect(repository.listPending).not.toHaveBeenCalled();
  });
});

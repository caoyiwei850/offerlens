// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createCommentsHandlers } from "./route";
import type { CommentRepository } from "@/lib/comments/repository";

const deviceId = "a".repeat(64);
const fingerprint = "b".repeat(64);

function makeRepository(): CommentRepository {
  return {
    create: vi.fn(() => ({
      id: "comment-1",
      status: "PENDING" as const,
    })),
    listPending: vi.fn(() => []),
    list: vi.fn(() => ({
      comments: [
        {
          id: "comment-1",
          nickname: "小林",
          rating: 5,
          content: "评测很具体。",
          createdAt: "2026-07-01T10:00:00.000Z",
        },
      ],
      nextCursor: null,
      stats: { total: 1, averageRating: 5 },
    })),
    moderate: vi.fn(() => true),
    softDelete: vi.fn(() => true),
    close: vi.fn(),
  };
}

function makePost(
  body: Record<string, unknown> = {
    nickname: "",
    rating: 5,
    content: "评测很具体。",
    deviceId,
    fingerprint,
  },
  cookie = `offerlens_device_id=${deviceId}`,
) {
  return new Request("http://localhost/api/comments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      "x-real-ip": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/comments", () => {
  it("returns a public comment page", async () => {
    const repository = makeRepository();
    const handlers = createCommentsHandlers({
      repository,
      checkAccess: async () => {
        throw new Error("GET must not check submission limits");
      },
    });

    const response = await handlers.GET(
      new Request("http://localhost/api/comments?limit=20"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      comments: [
        {
          id: "comment-1",
          nickname: "小林",
          rating: 5,
          content: "评测很具体。",
          createdAt: "2026-07-01T10:00:00.000Z",
        },
      ],
      nextCursor: null,
      stats: { total: 1, averageRating: 5 },
    });
  });

  it("accepts a normalized anonymous comment for moderation", async () => {
    const repository = makeRepository();
    const checkAccess = vi.fn(async () => ({
      allowed: true as const,
      deviceHash: "device-hash",
      ipHash: "ip-hash",
    }));
    const handlers = createCommentsHandlers({ repository, checkAccess });

    const response = await handlers.POST(makePost());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "comment-1",
      status: "PENDING",
    });
    expect(repository.create).toHaveBeenCalledWith({
      nickname: "匿名用户",
      rating: 5,
      content: "评测很具体。",
      deviceHash: "device-hash",
      ipHash: "ip-hash",
    });
    expect(checkAccess).toHaveBeenCalledWith({
      ip: "203.0.113.10",
      deviceId,
      fingerprint,
    });
  });

  it("rejects invalid input before consuming a rate-limit slot", async () => {
    const repository = makeRepository();
    const checkAccess = vi.fn();
    const handlers = createCommentsHandlers({ repository, checkAccess });

    const response = await handlers.POST(makePost({ content: "x" }));

    expect(response.status).toBe(400);
    expect(checkAccess).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a device that does not match the cookie", async () => {
    const repository = makeRepository();
    const checkAccess = vi.fn();
    const handlers = createCommentsHandlers({ repository, checkAccess });

    const response = await handlers.POST(makePost(undefined, "offerlens_device_id=wrong"));

    expect(response.status).toBe(400);
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it("returns retry information when comment submission is limited", async () => {
    const handlers = createCommentsHandlers({
      repository: makeRepository(),
      checkAccess: async () => ({
        allowed: false,
        reason: "cooldown",
        retryAfter: 42,
      }),
    });

    const response = await handlers.POST(makePost());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED", retryAfter: 42 },
    });
  });

  it("fails closed for writes when Redis is unavailable", async () => {
    const handlers = createCommentsHandlers({
      repository: makeRepository(),
      checkAccess: async () => {
        throw new Error("redis down");
      },
    });

    const response = await handlers.POST(makePost());

    expect(response.status).toBe(503);
  });
});

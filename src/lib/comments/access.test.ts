// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  checkCommentAccess,
  hashCommentIdentity,
  type CommentRateLimits,
} from "./access";

describe("comment access control", () => {
  it("uses salted hashes and the comment-specific limits", async () => {
    const evaluate = vi.fn(async (...args: [string[], CommentRateLimits]) => {
      void args;
      return [0, 0] as [number, number];
    });

    await expect(
      checkCommentAccess(
        {
          ip: "203.0.113.10",
          deviceId: "device-1",
          fingerprint: "fingerprint-1",
        },
        "comment-secret",
        { evaluate },
      ),
    ).resolves.toMatchObject({
      allowed: true,
      ipHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      deviceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    const [keys, limits] = evaluate.mock.calls[0];
    expect(keys).toHaveLength(3);
    expect(keys.join(":")).not.toContain("203.0.113.10");
    expect(keys.join(":")).not.toContain("device-1");
    expect(limits).toEqual({
      ipLimit: 10,
      ipWindowSeconds: 86400,
      deviceLimit: 3,
      deviceWindowSeconds: 86400,
      cooldownSeconds: 60,
    });
  });

  it.each([
    [1, "cooldown"],
    [2, "ip"],
    [3, "device"],
  ] as const)("maps denial code %s to %s", async (code, reason) => {
    const evaluate = vi.fn(async () => [code, 42] as [number, number]);

    await expect(
      checkCommentAccess(
        { ip: "203.0.113.10", deviceId: "device", fingerprint: "fingerprint" },
        "comment-secret",
        { evaluate },
      ),
    ).resolves.toEqual({ allowed: false, reason, retryAfter: 42 });
  });

  it("fails closed when Redis is unavailable", async () => {
    const evaluate = vi.fn(async () => {
      throw new Error("redis down");
    });

    await expect(
      checkCommentAccess(
        { ip: "203.0.113.10", deviceId: "device", fingerprint: "fingerprint" },
        "comment-secret",
        { evaluate },
      ),
    ).rejects.toThrow("评论服务暂时不可用");
  });

  it("changes hashes when the secret changes", () => {
    expect(hashCommentIdentity("secret-a", "same-value")).not.toBe(
      hashCommentIdentity("secret-b", "same-value"),
    );
  });
});

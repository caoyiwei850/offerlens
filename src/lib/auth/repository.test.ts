// @vitest-environment node

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";
import { createAuthRepository } from "./repository";

describe("auth repository", () => {
  it("stores a scrypt hash instead of the raw password and enforces unique email", async () => {
    const repository = createAuthRepository({
      path: ":memory:",
      createId: () => "user-1",
      now: () => "2026-07-09T00:00:00.000Z",
    });

    const passwordHash = await hashPassword("password-123");
    const user = repository.createUser({
      email: "test@example.com",
      passwordHash,
    });

    expect(user?.email).toBe("test@example.com");
    const stored = repository.findUserByEmail("test@example.com");
    expect(stored?.passwordHash).toMatch(/^scrypt:/);
    expect(stored?.passwordHash).not.toContain("password-123");
    expect(await verifyPassword("password-123", stored?.passwordHash ?? "")).toBe(true);
    expect(await verifyPassword("wrong-password", stored?.passwordHash ?? "")).toBe(false);
    expect(
      repository.createUser({
        email: "test@example.com",
        passwordHash,
      }),
    ).toBeNull();

    repository.close();
  });
});

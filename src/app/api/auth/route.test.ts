// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createLoginHandler, createRegisterHandler } from "@/lib/auth/api";
import { createAuthRepository } from "@/lib/auth/repository";

describe("auth routes", () => {
  it("registers, sets an HttpOnly session cookie, and logs in", async () => {
    const repository = createAuthRepository({
      path: ":memory:",
      createId: () => "user-1",
    });
    const dependencies = {
      repository,
      sessionSecret: "test-secret",
      hashPassword: async () => "hash",
      verifyPassword: async (_password: string, hash: string) => hash === "hash",
    };

    const register = await createRegisterHandler(dependencies)(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "USER@example.com",
          password: "password-123",
        }),
      }),
    );

    expect(register.status).toBe(200);
    expect(register.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await register.json()).toEqual({
      user: { id: "user-1", email: "user@example.com" },
    });

    const login = await createLoginHandler(dependencies)(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "user@example.com",
          password: "password-123",
        }),
      }),
    );

    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toContain("offerlens_session=");
    repository.close();
  });
});

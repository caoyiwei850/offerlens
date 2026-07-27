import { getAuthRepository } from "./repository-instance";
import { createSessionToken, sessionCookieHeader } from "./session";
import { hashPassword, verifyPassword } from "./password";
import {
  loginRequestSchema,
  registerRequestSchema,
  type AuthErrorCode,
  type SessionUser,
} from "./types";
import type { AuthRepository } from "./repository";

export function authError(
  status: number,
  code: AuthErrorCode,
  message: string,
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

interface AuthDependencies {
  repository: AuthRepository;
  sessionSecret: string;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (password: string, stored: string) => Promise<boolean>;
}

function userPayload(user: SessionUser) {
  return { user };
}

export function createRegisterHandler(dependencies: AuthDependencies) {
  return async function POST(request: Request): Promise<Response> {
    if (!dependencies.sessionSecret) {
      return authError(503, "AUTH_UNAVAILABLE", "账号系统暂时不可用");
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return authError(400, "INVALID_INPUT", "请求格式无效");
    }
    const parsed = registerRequestSchema.safeParse(body);
    if (!parsed.success) {
      return authError(400, "INVALID_INPUT", "邮箱或密码格式无效");
    }
    const passwordHash = await dependencies.hashPassword(parsed.data.password);
    const user = dependencies.repository.createUser({
      email: parsed.data.email,
      passwordHash,
    });
    if (!user) {
      return authError(409, "EMAIL_TAKEN", "这个邮箱已经注册");
    }
    const sessionUser = { id: user.id, email: user.email };
    const token = createSessionToken(sessionUser, dependencies.sessionSecret);
    return Response.json(userPayload(sessionUser), {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": sessionCookieHeader(token),
      },
    });
  };
}

export function createLoginHandler(dependencies: AuthDependencies) {
  return async function POST(request: Request): Promise<Response> {
    if (!dependencies.sessionSecret) {
      return authError(503, "AUTH_UNAVAILABLE", "账号系统暂时不可用");
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return authError(400, "INVALID_INPUT", "请求格式无效");
    }
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return authError(400, "INVALID_INPUT", "邮箱或密码格式无效");
    }
    const user = dependencies.repository.findUserByEmail(parsed.data.email);
    if (!user || !(await dependencies.verifyPassword(parsed.data.password, user.passwordHash))) {
      return authError(401, "INVALID_CREDENTIALS", "邮箱或密码不正确");
    }
    const sessionUser = { id: user.id, email: user.email };
    const token = createSessionToken(sessionUser, dependencies.sessionSecret);
    return Response.json(userPayload(sessionUser), {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": sessionCookieHeader(token),
      },
    });
  };
}

export function defaultAuthDependencies(): AuthDependencies {
  return {
    repository: getAuthRepository(),
    sessionSecret: process.env.SESSION_SECRET ?? "",
    hashPassword,
    verifyPassword,
  };
}


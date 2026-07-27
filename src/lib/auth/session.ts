import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import type { SessionUser } from "./types";

export const SESSION_COOKIE = "offerlens_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  user: SessionUser,
  secret: string,
  now = Date.now(),
): string {
  const payload = base64UrlEncode(
    JSON.stringify({
      user,
      iat: now,
      exp: now + SESSION_MAX_AGE_SECONDS * 1000,
      nonce: randomBytes(8).toString("hex"),
    }),
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function parseSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): SessionUser | null {
  if (!token || !secret) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as {
      user?: SessionUser;
      exp?: number;
    };
    if (!parsed.user?.id || !parsed.user.email || !parsed.exp) return null;
    if (parsed.exp <= now) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionCookie(request: Request | NextRequest): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function getSessionUser(
  request: Request | NextRequest,
  secret = process.env.SESSION_SECRET ?? "",
): SessionUser | null {
  return parseSessionToken(readSessionCookie(request), secret);
}


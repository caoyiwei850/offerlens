import { timingSafeEqual } from "node:crypto";

export function isFeedbackAdminAuthorized(
  request: Request,
  expectedToken: string,
): boolean {
  if (!expectedToken) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const left = Buffer.from(received);
  const right = Buffer.from(expectedToken);
  return left.length === right.length && timingSafeEqual(left, right);
}

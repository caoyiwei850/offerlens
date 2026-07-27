import { timingSafeEqual } from "node:crypto";

export function isCommentAdminAuthorized(
  request: Request,
  expectedToken: string,
): boolean {
  if (!expectedToken) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expectedToken);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

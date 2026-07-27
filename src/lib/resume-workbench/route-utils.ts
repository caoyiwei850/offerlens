export function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

import { ZodError } from "zod";

export function apiError(
  status: number,
  code: string,
  message: string,
  retryAfter?: number,
): Response {
  return Response.json(
    { error: { code, message, ...(retryAfter ? { retryAfter } : {}) } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}

export function summarizeResumeError(error: unknown): string {
  if (error instanceof ZodError) {
    return JSON.stringify(
      error.issues.slice(0, 12).map((issue) => ({
        code: issue.code,
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  if (error instanceof SyntaxError) return "INVALID_JSON";
  if (error instanceof Error) {
    if (/^(FACT_REF_MISSING|FACT_REF_UNKNOWN):/.test(error.message)) {
      return error.message;
    }
    return error.name;
  }
  return "UNKNOWN_ERROR";
}

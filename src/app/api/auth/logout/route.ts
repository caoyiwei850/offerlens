import { clearSessionCookieHeader } from "@/lib/auth/session";

export const runtime = "nodejs";

export function POST(): Response {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": clearSessionCookieHeader(),
      },
    },
  );
}


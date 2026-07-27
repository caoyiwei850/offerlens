import { getSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export function GET(request: Request): Response {
  const user = getSessionUser(request);
  return Response.json(
    { user },
    { headers: { "Cache-Control": "no-store" } },
  );
}


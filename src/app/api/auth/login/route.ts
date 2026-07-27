import { createLoginHandler, defaultAuthDependencies } from "@/lib/auth/api";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return createLoginHandler(defaultAuthDependencies())(request);
}


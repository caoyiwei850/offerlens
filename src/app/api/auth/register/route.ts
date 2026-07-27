import { createRegisterHandler, defaultAuthDependencies } from "@/lib/auth/api";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return createRegisterHandler(defaultAuthDependencies())(request);
}


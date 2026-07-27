import {
  createResumeProfilesHandlers,
  defaultWorkspaceDependencies,
} from "@/lib/workspace/api";

export const runtime = "nodejs";

export function GET(request: Request): Response {
  return createResumeProfilesHandlers(defaultWorkspaceDependencies()).GET(request);
}

export function POST(request: Request): Promise<Response> {
  return createResumeProfilesHandlers(defaultWorkspaceDependencies()).POST(request);
}

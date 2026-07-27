import {
  createApplicationsHandlers,
  defaultWorkspaceDependencies,
} from "@/lib/workspace/api";

export const runtime = "nodejs";

export function GET(request: Request): Response {
  return createApplicationsHandlers(defaultWorkspaceDependencies()).GET(request);
}

export function POST(request: Request): Promise<Response> {
  return createApplicationsHandlers(defaultWorkspaceDependencies()).POST(request);
}

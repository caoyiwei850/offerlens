import {
  createImportSessionHandler,
  defaultWorkspaceDependencies,
} from "@/lib/workspace/api";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return createImportSessionHandler(defaultWorkspaceDependencies())(request);
}


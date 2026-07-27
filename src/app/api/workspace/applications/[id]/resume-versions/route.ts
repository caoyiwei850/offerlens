import {
  createResumeVersionsHandlers,
  defaultWorkspaceDependencies,
} from "@/lib/workspace/api";

export const runtime = "nodejs";

export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const handlers = createResumeVersionsHandlers(defaultWorkspaceDependencies());
  return params.then(({ id }) => handlers.GET(request, id));
}

export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const handlers = createResumeVersionsHandlers(defaultWorkspaceDependencies());
  return params.then(({ id }) => handlers.POST(request, id));
}

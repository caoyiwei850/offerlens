import {
  createInterviewPackHandler,
  defaultModelDependencies,
} from "@/lib/workspace/api";

export const runtime = "nodejs";

export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return params.then(({ id }) =>
    createInterviewPackHandler(defaultModelDependencies())(request, id),
  );
}


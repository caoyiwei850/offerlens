import { createHmac, timingSafeEqual } from "node:crypto";

import type { AnalyticsRepository } from "@/lib/analytics/repository";
import { getAnalyticsRepository } from "@/lib/analytics/repository-instance";
import {
  analyticsEventSchema,
  analyticsSummaryQuerySchema,
} from "@/lib/analytics/types";

export const runtime = "nodejs";

interface AnalyticsDependencies {
  repository: AnalyticsRepository;
  hashSecret: string;
  adminToken: string;
}

function isAuthorized(request: Request, expectedToken: string): boolean {
  if (!expectedToken) return false;
  const header = request.headers.get("authorization") ?? "";
  const received = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(received);
  const right = Buffer.from(expectedToken);
  return left.length === right.length && timingSafeEqual(left, right);
}

function hashSession(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId).digest("hex");
}

export function createAnalyticsHandlers(dependencies: AnalyticsDependencies) {
  return {
    async POST(request: Request): Promise<Response> {
      if (dependencies.hashSecret.length < 16) {
        return Response.json(
          { error: { code: "ANALYTICS_UNAVAILABLE" } },
          { status: 503 },
        );
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { error: { code: "INVALID_INPUT" } },
          { status: 400 },
        );
      }
      const parsed = analyticsEventSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: { code: "INVALID_INPUT" } },
          { status: 400 },
        );
      }
      try {
        dependencies.repository.record({
          eventId: parsed.data.eventId,
          sessionHash: hashSession(
            parsed.data.sessionId,
            dependencies.hashSecret,
          ),
          type: parsed.data.type,
          dimensions: parsed.data.dimensions,
        });
        return new Response(null, {
          status: 202,
          headers: { "Cache-Control": "no-store" },
        });
      } catch {
        return Response.json(
          { error: { code: "ANALYTICS_UNAVAILABLE" } },
          { status: 503 },
        );
      }
    },

    GET(request: Request): Response {
      if (!isAuthorized(request, dependencies.adminToken)) {
        return Response.json(
          { error: { code: "UNAUTHORIZED" } },
          { status: 401 },
        );
      }
      const url = new URL(request.url);
      const query = analyticsSummaryQuerySchema.safeParse({
        days: url.searchParams.get("days") ?? "7",
      });
      if (!query.success) {
        return Response.json(
          { error: { code: "INVALID_INPUT" } },
          { status: 400 },
        );
      }
      try {
        return Response.json(
          dependencies.repository.summary(query.data.days as 7 | 30),
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return Response.json(
          { error: { code: "ANALYTICS_UNAVAILABLE" } },
          { status: 503 },
        );
      }
    },
  };
}

function defaultHandlers() {
  return createAnalyticsHandlers({
    repository: getAnalyticsRepository(),
    hashSecret: process.env.ANALYTICS_HASH_SECRET ?? "",
    adminToken: process.env.ANALYTICS_ADMIN_TOKEN ?? "",
  });
}

export function POST(request: Request): Promise<Response> {
  return defaultHandlers().POST(request);
}

export function GET(request: Request): Response {
  return defaultHandlers().GET(request);
}

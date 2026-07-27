// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createAnalyticsHandlers } from "./route";
import { createAnalyticsRepository } from "@/lib/analytics/repository";

const secret = "analytics-secret-for-tests";
const event = {
  eventId: "e".repeat(32),
  sessionId: "s".repeat(32),
  type: "LANDING_VIEWED",
  dimensions: {},
};

describe("/api/analytics", () => {
  it("accepts a valid anonymous event and rejects free text", async () => {
    const repository = createAnalyticsRepository({ path: ":memory:" });
    const handlers = createAnalyticsHandlers({
      repository,
      hashSecret: secret,
      adminToken: "admin-token",
    });

    const accepted = await handlers.POST(
      new Request("http://localhost/api/analytics", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );
    expect(accepted.status).toBe(202);

    const rejected = await handlers.POST(
      new Request("http://localhost/api/analytics", {
        method: "POST",
        body: JSON.stringify({ ...event, resume: "private" }),
      }),
    );
    expect(rejected.status).toBe(400);
    repository.close();
  });

  it("requires a bearer token for funnel summaries", () => {
    const repository = createAnalyticsRepository({ path: ":memory:" });
    const handlers = createAnalyticsHandlers({
      repository,
      hashSecret: secret,
      adminToken: "admin-token",
    });
    expect(
      handlers.GET(new Request("http://localhost/api/analytics?days=7")).status,
    ).toBe(401);
    const response = handlers.GET(
      new Request("http://localhost/api/analytics?days=7", {
        headers: { authorization: "Bearer admin-token" },
      }),
    );
    expect(response.status).toBe(200);
    repository.close();
  });
});

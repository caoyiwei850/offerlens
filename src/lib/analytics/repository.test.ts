// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createAnalyticsRepository } from "./repository";

const sessionA = "a".repeat(64);
const sessionB = "b".repeat(64);

describe("analytics repository", () => {
  it("deduplicates events and summarizes a session funnel", () => {
    const repository = createAnalyticsRepository({
      path: ":memory:",
      now: () => "2026-07-04T02:00:00.000Z",
    });

    expect(
      repository.record({
        eventId: "event-1",
        sessionHash: sessionA,
        type: "LANDING_VIEWED",
        dimensions: {},
      }),
    ).toBe("RECORDED");
    expect(
      repository.record({
        eventId: "event-1",
        sessionHash: sessionA,
        type: "LANDING_VIEWED",
        dimensions: {},
      }),
    ).toBe("DUPLICATE");
    repository.record({
      eventId: "event-2",
      sessionHash: sessionA,
      type: "ANALYSIS_STARTED",
      dimensions: { inputMode: "TEXT" },
    });
    repository.record({
      eventId: "event-3",
      sessionHash: sessionA,
      type: "ANALYSIS_SUCCEEDED",
      dimensions: {
        occupationFamily: "HEALTHCARE_CARE",
        result: "PASS",
        applicationStatus: "READY",
        durationMs: 10_000,
      },
    });
    repository.record({
      eventId: "event-4",
      sessionHash: sessionB,
      type: "LANDING_VIEWED",
      dimensions: {},
    });

    const summary = repository.summary(7);
    expect(summary.funnel).toMatchObject({
      landingSessions: 2,
      analysisStartedSessions: 1,
      analysisSucceededSessions: 1,
      activationRate: 0.5,
      completionRate: 1,
    });
    expect(summary.events.ANALYSIS_SUCCEEDED).toBe(1);
    expect(summary.occupations).toEqual([
      { occupationFamily: "HEALTHCARE_CARE", sessions: 1 },
    ]);
    repository.close();
  });

  it("aggregates failures by bounded error code", () => {
    const repository = createAnalyticsRepository({
      path: ":memory:",
      now: () => "2026-07-04T02:00:00.000Z",
    });
    repository.record({
      eventId: "event-1",
      sessionHash: sessionA,
      type: "ANALYSIS_FAILED",
      dimensions: { errorCode: "MODEL_ERROR", durationMs: 4_000 },
    });
    expect(repository.summary(7).errors).toEqual([
      { errorCode: "MODEL_ERROR", events: 1 },
    ]);
    repository.close();
  });
});

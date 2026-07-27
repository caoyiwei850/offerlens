import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackAnalytics, trackAnalyticsOnce } from "./analytics";

describe("client analytics", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("reuses one anonymous session without device or content data", async () => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: undefined,
    });
    const requests: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requests.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 202 });
      }),
    );

    trackAnalytics("LANDING_VIEWED", {});
    trackAnalytics("ANALYSIS_STARTED", { inputMode: "TEXT" });
    await vi.waitFor(() => expect(requests).toHaveLength(2));

    const [first, second] = requests as Array<Record<string, unknown>>;
    expect(first.sessionId).toBe(second.sessionId);
    expect(first).not.toHaveProperty("deviceId");
    expect(JSON.stringify(requests)).not.toContain("resume");
  });

  it("records page-level funnel events once per tab session", async () => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: undefined,
    });
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);

    trackAnalyticsOnce("landing", "LANDING_VIEWED", {});
    trackAnalyticsOnce("landing", "LANDING_VIEWED", {});
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  });
});

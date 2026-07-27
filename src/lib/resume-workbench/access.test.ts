// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  beijingDayWindow,
  checkResumePlanAccess,
  issueRewriteToken,
  consumeRewriteToken,
  type ResumeAccessStore,
} from "./access";

function store(): ResumeAccessStore {
  return {
    evaluatePlan: vi.fn(async () => [0, 0] as [number, number]),
    saveToken: vi.fn(async () => undefined),
    consumeToken: vi.fn(async () => true),
  };
}

describe("resume rewrite access", () => {
  it("resets at the next Beijing midnight", () => {
    expect(beijingDayWindow(new Date("2026-07-02T15:59:00.000Z"))).toEqual({
      dateKey: "2026-07-02",
      ttlSeconds: 60,
    });
    expect(beijingDayWindow(new Date("2026-07-02T16:01:00.000Z"))).toEqual({
      dateKey: "2026-07-03",
      ttlSeconds: 86_340,
    });
  });

  it("allows twenty plans per Beijing calendar day by default", async () => {
    const accessStore = store();
    await expect(
      checkResumePlanAccess(
        {
          ip: "203.0.113.10",
          deviceId: "a".repeat(64),
          fingerprint: "b".repeat(64),
        },
        accessStore,
        new Date("2026-07-02T10:00:00.000Z"),
      ),
    ).resolves.toEqual({ allowed: true });

    expect(accessStore.evaluatePlan).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining("resume:device:"),
        expect.stringContaining("resume:day:2026-07-02"),
      ]),
      expect.objectContaining({ deviceLimit: 20 }),
    );
  });

  it("allows deployment-specific resume plan limits", async () => {
    vi.stubEnv("RESUME_PLAN_DEVICE_DAILY_LIMIT", "50");
    vi.stubEnv("RESUME_PLAN_IP_WINDOW_LIMIT", "30");
    vi.stubEnv("RESUME_PLAN_COOLDOWN_SECONDS", "2");
    vi.stubEnv("GLOBAL_DAILY_RESUME_LIMIT", "5000");
    const accessStore = store();

    await checkResumePlanAccess(
      {
        ip: "203.0.113.10",
        deviceId: "a".repeat(64),
        fingerprint: "b".repeat(64),
      },
      accessStore,
      new Date("2026-07-02T10:00:00.000Z"),
    );

    expect(accessStore.evaluatePlan).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        deviceLimit: 50,
        ipLimit: 30,
        cooldownSeconds: 2,
        globalLimit: 5000,
      }),
    );
  });

  it("binds a one-time rewrite token to the device", async () => {
    const accessStore = store();
    const token = await issueRewriteToken("device-hash", accessStore);

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(accessStore.saveToken).toHaveBeenCalledWith(
      expect.any(String),
      "device-hash",
      7_200,
    );
    await expect(
      consumeRewriteToken(token, "device-hash", accessStore),
    ).resolves.toBe(true);
  });
});

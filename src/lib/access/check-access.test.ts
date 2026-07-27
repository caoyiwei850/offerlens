import { describe, expect, it, vi } from "vitest";

import {
  checkAnalyzeAccess,
  checkAnalyzeCorrectionAccess,
  type AccessLimits,
} from "./check-access";

describe("checkAnalyzeAccess", () => {
  it("allows a request when the atomic store approves it", async () => {
    const evaluate = vi.fn(async (...args: [string[], AccessLimits]) => {
      void args;
      return [0, 0] as [number, number];
    });

    await expect(
      checkAnalyzeAccess(
        { ip: "203.0.113.10", deviceId: "device-1", fingerprint: "fingerprint-1" },
        { evaluate },
      ),
    ).resolves.toEqual({ allowed: true });

    expect(evaluate).toHaveBeenCalledOnce();
    const [keys, limits] = evaluate.mock.calls[0];
    expect(keys).toHaveLength(4);
    expect(keys.join(":")).not.toContain("203.0.113.10");
    expect(limits).toEqual({
      ipLimit: 10,
      ipWindowSeconds: 600,
      deviceLimit: 5,
      deviceWindowSeconds: 86400,
      cooldownSeconds: 8,
      globalLimit: 1000,
      globalWindowSeconds: 86400,
    });
  });

  it.each([
    [1, "cooldown"],
    [2, "ip"],
    [3, "device"],
    [4, "global"],
  ] as const)("maps store denial code %s to %s", async (code, reason) => {
    const evaluate = vi.fn(async () => [code, 42] as [number, number]);

    await expect(
      checkAnalyzeAccess(
        { ip: "203.0.113.10", deviceId: "device-1", fingerprint: "fingerprint-1" },
        { evaluate },
      ),
    ).resolves.toEqual({ allowed: false, reason, retryAfter: 42 });
  });

  it("fails closed when Redis is unavailable", async () => {
    const evaluate = vi.fn(async () => {
      throw new Error("redis down");
    });

    await expect(
      checkAnalyzeAccess(
        { ip: "203.0.113.10", deviceId: "device-1", fingerprint: "fingerprint-1" },
        { evaluate },
      ),
    ).rejects.toThrow("访问控制暂时不可用");
  });

  it("treats zero IP and device limits as unlimited acquisition mode", async () => {
    vi.stubEnv("ANALYSIS_IP_LIMIT", "0");
    vi.stubEnv("ANALYSIS_DEVICE_LIMIT", "0");
    const evaluate = vi.fn(
      async (...args: [string[], AccessLimits]) => {
        void args;
        return [0, 0] as [number, number];
      },
    );

    await checkAnalyzeAccess(
      { ip: "203.0.113.10", deviceId: "device-1", fingerprint: "fingerprint-1" },
      { evaluate },
    );

    expect(evaluate.mock.calls[0][1]).toMatchObject({
      ipLimit: 0,
      deviceLimit: 0,
      cooldownSeconds: 8,
      globalLimit: 1000,
    });
    vi.unstubAllEnvs();
  });
});

describe("checkAnalyzeCorrectionAccess", () => {
  it("uses the correction limiter that excludes the device daily counter", async () => {
    const evaluate = vi.fn(async () => [0, 0] as [number, number]);
    const evaluateCorrection = vi.fn(
      async (...args: [string[], AccessLimits]) => {
        void args;
        return [0, 0] as [number, number];
      },
    );

    await expect(
      checkAnalyzeCorrectionAccess(
        { ip: "203.0.113.10", deviceId: "device-1", fingerprint: "fingerprint-1" },
        { evaluate, evaluateCorrection },
      ),
    ).resolves.toEqual({ allowed: true });

    expect(evaluate).not.toHaveBeenCalled();
    expect(evaluateCorrection).toHaveBeenCalledOnce();
    expect(evaluateCorrection.mock.calls[0][0]).toHaveLength(3);
  });
});

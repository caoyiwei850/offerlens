import { describe, expect, it } from "vitest";

import {
  buildFingerprintSource,
  createDeviceSalt,
  digestIdentity,
} from "./device-identity";

describe("buildFingerprintSource", () => {
  it("uses only the agreed lightweight browser signals", () => {
    expect(
      buildFingerprintSource({
        userAgent: "Test Browser",
        width: 1440,
        height: 900,
        timezone: "Asia/Shanghai",
        language: "zh-CN",
      }),
    ).toBe("Test Browser|1440x900|Asia/Shanghai|zh-CN");
  });
});

describe("HTTP compatibility", () => {
  it("creates a stable 64-character digest without SubtleCrypto", async () => {
    const first = await digestIdentity("same-device", null);
    const second = await digestIdentity("same-device", null);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(await digestIdentity("different-device", null)).not.toBe(first);
  });

  it("creates a salt when randomUUID is unavailable", () => {
    const salt = createDeviceSalt({
      getRandomValues: (values) => {
        values.fill(7);
        return values;
      },
    });

    expect(salt).toBe("07070707070707070707070707070707");
  });
});

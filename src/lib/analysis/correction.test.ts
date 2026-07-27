import { describe, expect, it, vi } from "vitest";

import {
  claimOccupationCorrection,
  completeOccupationCorrection,
  issueOccupationCorrection,
  releaseOccupationCorrection,
  type OccupationCorrectionStore,
} from "./correction";

const identity = {
  deviceId: "a".repeat(64),
  fingerprint: "b".repeat(64),
};

function fakeStore(): OccupationCorrectionStore & {
  saved?: { tokenHash: string; deviceHash: string; ttlSeconds: number };
} {
  return {
    async saveToken(tokenHash, deviceHash, ttlSeconds) {
      this.saved = { tokenHash, deviceHash, ttlSeconds };
    },
    claimToken: vi.fn(async () => true),
    completeToken: vi.fn(async () => true),
    releaseToken: vi.fn(async () => undefined),
  };
}

describe("occupation correction tokens", () => {
  it("issues a two-hour token bound to the device without storing the raw token", async () => {
    const store = fakeStore();
    const correction = await issueOccupationCorrection(identity, store, {
      now: new Date("2026-07-03T00:00:00.000Z"),
      randomToken: () => "raw-correction-token",
    });

    expect(correction.token).toBe("raw-correction-token");
    expect(correction.expires_at).toBe("2026-07-03T02:00:00.000Z");
    expect(store.saved?.ttlSeconds).toBe(7200);
    expect(store.saved?.tokenHash).not.toContain("raw-correction-token");
    expect(store.saved?.deviceHash).toHaveLength(64);
  });

  it("claims, completes and releases a token through the store boundary", async () => {
    const store = fakeStore();
    await expect(
      claimOccupationCorrection("token", "claim", identity, store),
    ).resolves.toBe(true);
    await expect(
      completeOccupationCorrection("token", "claim", identity, store),
    ).resolves.toBe(true);
    await releaseOccupationCorrection("token", "claim", identity, store);

    expect(store.claimToken).toHaveBeenCalledOnce();
    expect(store.completeToken).toHaveBeenCalledOnce();
    expect(store.releaseToken).toHaveBeenCalledOnce();
  });
});

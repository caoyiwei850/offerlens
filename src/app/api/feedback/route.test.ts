// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createFeedbackHandlers } from "./route";
import { createFeedbackRepository } from "@/lib/feedback/repository";

const deviceId = "a".repeat(64);
const body = {
  kind: "INTERVIEW_OUTCOME",
  outcome: "OFFERED",
  predictionMatch: "MATCHED",
  rating: 5,
  content: "实际面试重点和模拟结果一致。",
  occupationFamily: "BUSINESS_COMMERCIAL",
  deviceId,
  fingerprint: "b".repeat(64),
};

describe("/api/feedback", () => {
  it("accepts feedback without any analysis session", async () => {
    const repository = createFeedbackRepository({
      path: ":memory:",
      createId: () => "feedback-1",
    });
    const handlers = createFeedbackHandlers({
      repository,
      adminToken: "admin-token-for-tests",
      checkAccess: async () => ({
        allowed: true,
        ipHash: "ip-hash",
        deviceHash: "device-hash",
      }),
    });

    const response = await handlers.POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `offerlens_device_id=${deviceId}`,
          "x-real-ip": "203.0.113.10",
        },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "feedback-1",
      status: "RECEIVED",
    });
    expect(repository.listRecent(10)).toHaveLength(1);
    repository.close();
  });

  it("rejects a mismatched device cookie", async () => {
    const repository = createFeedbackRepository({ path: ":memory:" });
    const handlers = createFeedbackHandlers({
      repository,
      adminToken: "admin-token-for-tests",
      checkAccess: async () => ({
        allowed: true,
        ipHash: "ip-hash",
        deviceHash: "device-hash",
      }),
    });

    const response = await handlers.POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `offerlens_device_id=${"c".repeat(64)}`,
          "x-real-ip": "203.0.113.10",
        },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(400);
    repository.close();
  });

  it("keeps feedback private behind an admin token", async () => {
    const repository = createFeedbackRepository({ path: ":memory:" });
    const handlers = createFeedbackHandlers({
      repository,
      adminToken: "admin-token-for-tests",
      checkAccess: async () => ({
        allowed: true,
        ipHash: "ip-hash",
        deviceHash: "device-hash",
      }),
    });

    expect(
      handlers.GET(new Request("http://localhost/api/feedback?limit=20")).status,
    ).toBe(401);
    expect(
      handlers.GET(
        new Request("http://localhost/api/feedback?limit=20", {
          headers: { authorization: "Bearer admin-token-for-tests" },
        }),
      ).status,
    ).toBe(200);
    repository.close();
  });
});

import { createHmac } from "node:crypto";

export interface FeedbackAccessIdentity {
  ip: string;
  deviceId: string;
  fingerprint: string;
}

export interface FeedbackRateLimits {
  ipLimit: number;
  ipWindowSeconds: number;
  deviceLimit: number;
  deviceWindowSeconds: number;
  cooldownSeconds: number;
}

export interface FeedbackRateLimitStore {
  evaluate(
    keys: string[],
    limits: FeedbackRateLimits,
  ): Promise<[number, number]>;
}

export type FeedbackAccessDecision =
  | { allowed: true; ipHash: string; deviceHash: string }
  | {
      allowed: false;
      reason: "cooldown" | "ip" | "device";
      retryAfter: number;
    };

const FEEDBACK_LIMITS: FeedbackRateLimits = {
  ipLimit: 20,
  ipWindowSeconds: 24 * 60 * 60,
  deviceLimit: 5,
  deviceWindowSeconds: 24 * 60 * 60,
  cooldownSeconds: 30,
};

const denialReasons = {
  1: "cooldown",
  2: "ip",
  3: "device",
} as const;

function hashIdentity(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function checkFeedbackAccess(
  identity: FeedbackAccessIdentity,
  secret: string,
  store: FeedbackRateLimitStore,
): Promise<FeedbackAccessDecision> {
  if (secret.length < 16) {
    throw new Error("反馈服务暂时不可用");
  }
  const ipHash = hashIdentity(secret, identity.ip);
  const deviceHash = hashIdentity(
    secret,
    `${identity.deviceId}:${identity.fingerprint}`,
  );
  const keys = [
    `offerlens:feedback:ip:${ipHash}`,
    `offerlens:feedback:device:${deviceHash}`,
    `offerlens:feedback:cooldown:${deviceHash}`,
  ];

  try {
    const [code, retryAfter] = await store.evaluate(keys, FEEDBACK_LIMITS);
    if (code === 0) return { allowed: true, ipHash, deviceHash };
    const reason = denialReasons[code as keyof typeof denialReasons];
    if (!reason) throw new Error("unexpected feedback limit response");
    return { allowed: false, reason, retryAfter: Math.max(1, retryAfter) };
  } catch {
    throw new Error("反馈服务暂时不可用");
  }
}

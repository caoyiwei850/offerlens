import { createHmac } from "node:crypto";

export interface CommentAccessIdentity {
  ip: string;
  deviceId: string;
  fingerprint: string;
}

export interface CommentRateLimits {
  ipLimit: number;
  ipWindowSeconds: number;
  deviceLimit: number;
  deviceWindowSeconds: number;
  cooldownSeconds: number;
}

export interface CommentRateLimitStore {
  evaluate(keys: string[], limits: CommentRateLimits): Promise<[number, number]>;
}

export type CommentAccessDecision =
  | { allowed: true; ipHash: string; deviceHash: string }
  | {
      allowed: false;
      reason: "cooldown" | "ip" | "device";
      retryAfter: number;
    };

const COMMENT_LIMITS: CommentRateLimits = {
  ipLimit: 10,
  ipWindowSeconds: 24 * 60 * 60,
  deviceLimit: 3,
  deviceWindowSeconds: 24 * 60 * 60,
  cooldownSeconds: 60,
};

const denialReasons = {
  1: "cooldown",
  2: "ip",
  3: "device",
} as const;

export function hashCommentIdentity(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function checkCommentAccess(
  identity: CommentAccessIdentity,
  secret: string,
  store: CommentRateLimitStore,
): Promise<CommentAccessDecision> {
  if (!secret) {
    throw new Error("评论服务暂时不可用");
  }
  const ipHash = hashCommentIdentity(secret, identity.ip);
  const deviceHash = hashCommentIdentity(
    secret,
    `${identity.deviceId}:${identity.fingerprint}`,
  );
  const keys = [
    `offerlens:comment:ip:${ipHash}`,
    `offerlens:comment:device:${deviceHash}`,
    `offerlens:comment:cooldown:${deviceHash}`,
  ];

  try {
    const [code, retryAfter] = await store.evaluate(keys, COMMENT_LIMITS);
    if (code === 0) {
      return { allowed: true, ipHash, deviceHash };
    }
    const reason = denialReasons[code as keyof typeof denialReasons];
    if (!reason) {
      throw new Error("unexpected comment rate-limit response");
    }
    return { allowed: false, reason, retryAfter: Math.max(1, retryAfter) };
  } catch {
    throw new Error("评论服务暂时不可用");
  }
}

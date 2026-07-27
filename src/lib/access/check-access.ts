import { createHash } from "node:crypto";

export interface AccessIdentity {
  ip: string;
  deviceId: string;
  fingerprint: string;
}

export interface AccessLimits {
  ipLimit: number;
  ipWindowSeconds: number;
  deviceLimit: number;
  deviceWindowSeconds: number;
  cooldownSeconds: number;
  globalLimit: number;
  globalWindowSeconds: number;
}

export interface RateLimitStore {
  evaluate(keys: string[], limits: AccessLimits): Promise<[number, number]>;
  evaluateCorrection?(
    keys: string[],
    limits: AccessLimits,
  ): Promise<[number, number]>;
}

export type AccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "cooldown" | "ip" | "device" | "global";
      retryAfter: number;
    };

const DEFAULT_LIMITS: AccessLimits = {
  ipLimit: 10,
  ipWindowSeconds: 10 * 60,
  deviceLimit: 5,
  deviceWindowSeconds: 24 * 60 * 60,
  cooldownSeconds: 8,
  globalLimit: 1_000,
  globalWindowSeconds: 24 * 60 * 60,
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readGlobalLimit(): number {
  const parsed = Number.parseInt(process.env.GLOBAL_DAILY_ANALYSIS_LIMIT ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_LIMITS.globalLimit;
}

function readUserLimit(
  name: "ANALYSIS_IP_LIMIT" | "ANALYSIS_DEVICE_LIMIT",
  fallback: number,
): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function readLimits(): AccessLimits {
  return {
    ...DEFAULT_LIMITS,
    ipLimit: readUserLimit("ANALYSIS_IP_LIMIT", DEFAULT_LIMITS.ipLimit),
    deviceLimit: readUserLimit(
      "ANALYSIS_DEVICE_LIMIT",
      DEFAULT_LIMITS.deviceLimit,
    ),
    globalLimit: readGlobalLimit(),
  };
}

const denialReasons = {
  1: "cooldown",
  2: "ip",
  3: "device",
  4: "global",
} as const;

export async function checkAnalyzeAccess(
  identity: AccessIdentity,
  store: RateLimitStore,
): Promise<AccessDecision> {
  const deviceHash = digest(`${identity.deviceId}:${identity.fingerprint}`);
  const keys = [
    `offerlens:ip:${digest(identity.ip)}`,
    `offerlens:device:${deviceHash}`,
    `offerlens:cooldown:${deviceHash}`,
    `offerlens:global:${new Date().toISOString().slice(0, 10)}`,
  ];
  const limits = readLimits();

  try {
    const [code, retryAfter] = await store.evaluate(keys, limits);
    if (code === 0) {
      return { allowed: true };
    }
    const reason = denialReasons[code as keyof typeof denialReasons];
    if (!reason) {
      throw new Error("unexpected rate-limit response");
    }
    return { allowed: false, reason, retryAfter: Math.max(1, retryAfter) };
  } catch {
    throw new Error("访问控制暂时不可用");
  }
}

export async function checkAnalyzeCorrectionAccess(
  identity: AccessIdentity,
  store: RateLimitStore,
): Promise<AccessDecision> {
  if (!store.evaluateCorrection) {
    throw new Error("访问控制暂时不可用");
  }
  const deviceHash = digest(`${identity.deviceId}:${identity.fingerprint}`);
  const keys = [
    `offerlens:ip:${digest(identity.ip)}`,
    `offerlens:cooldown:${deviceHash}`,
    `offerlens:global:${new Date().toISOString().slice(0, 10)}`,
  ];
  const limits = readLimits();

  try {
    const [code, retryAfter] = await store.evaluateCorrection(keys, limits);
    if (code === 0) return { allowed: true };
    const reason =
      code === 1 ? "cooldown" : code === 2 ? "ip" : code === 4 ? "global" : null;
    if (!reason) throw new Error("unexpected rate-limit response");
    return { allowed: false, reason, retryAfter: Math.max(1, retryAfter) };
  } catch {
    throw new Error("访问控制暂时不可用");
  }
}

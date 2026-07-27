import { createHash, randomBytes } from "node:crypto";

export interface ResumeAccessIdentity {
  ip: string;
  deviceId: string;
  fingerprint: string;
}

export interface ResumePlanLimits {
  ipLimit: number;
  ipWindowSeconds: number;
  deviceLimit: number;
  deviceWindowSeconds: number;
  cooldownSeconds: number;
  globalLimit: number;
}

export interface ResumeAccessStore {
  evaluatePlan(
    keys: string[],
    limits: ResumePlanLimits,
  ): Promise<[number, number]>;
  saveToken(tokenHash: string, deviceHash: string, ttlSeconds: number): Promise<void>;
  consumeToken(tokenHash: string, deviceHash: string): Promise<boolean>;
}

export type ResumeAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "cooldown" | "ip" | "device" | "global";
      retryAfter: number;
    };

const DEFAULT_LIMITS = {
  ipLimit: 10,
  ipWindowSeconds: 10 * 60,
  deviceLimit: 20,
  cooldownSeconds: 8,
  globalLimit: 1_000,
} as const;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashResumeDevice(deviceId: string, fingerprint: string): string {
  return digest(`${deviceId}:${fingerprint}`);
}

export function beijingDayWindow(now = new Date()): {
  dateKey: string;
  ttlSeconds: number;
} {
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
  const year = beijing.getUTCFullYear();
  const month = beijing.getUTCMonth();
  const day = beijing.getUTCDate();
  const nextMidnightUtc = Date.UTC(year, month, day + 1) - 8 * 60 * 60 * 1_000;
  return {
    dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ttlSeconds: Math.max(1, Math.ceil((nextMidnightUtc - now.getTime()) / 1_000)),
  };
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function checkResumePlanAccess(
  identity: ResumeAccessIdentity,
  store: ResumeAccessStore,
  now = new Date(),
): Promise<ResumeAccessDecision> {
  const deviceHash = hashResumeDevice(identity.deviceId, identity.fingerprint);
  const day = beijingDayWindow(now);
  const keys = [
    `offerlens:resume:ip:${digest(identity.ip)}`,
    `offerlens:resume:device:${deviceHash}:${day.dateKey}`,
    `offerlens:resume:cooldown:${deviceHash}`,
    `offerlens:resume:day:${day.dateKey}`,
  ];
  const limits: ResumePlanLimits = {
    ...DEFAULT_LIMITS,
    ipLimit: readPositiveIntegerEnv(
      "RESUME_PLAN_IP_WINDOW_LIMIT",
      DEFAULT_LIMITS.ipLimit,
    ),
    deviceLimit: readPositiveIntegerEnv(
      "RESUME_PLAN_DEVICE_DAILY_LIMIT",
      DEFAULT_LIMITS.deviceLimit,
    ),
    cooldownSeconds: readPositiveIntegerEnv(
      "RESUME_PLAN_COOLDOWN_SECONDS",
      DEFAULT_LIMITS.cooldownSeconds,
    ),
    deviceWindowSeconds: day.ttlSeconds,
    globalLimit: readPositiveIntegerEnv(
      "GLOBAL_DAILY_RESUME_LIMIT",
      DEFAULT_LIMITS.globalLimit,
    ),
  };
  try {
    const [code, retryAfter] = await store.evaluatePlan(keys, limits);
    if (code === 0) return { allowed: true };
    const reasons = {
      1: "cooldown",
      2: "ip",
      3: "device",
      4: "global",
    } as const;
    const reason = reasons[code as keyof typeof reasons];
    if (!reason) throw new Error("unexpected resume limit response");
    return { allowed: false, reason, retryAfter: Math.max(1, retryAfter) };
  } catch {
    throw new Error("简历改写访问控制暂时不可用");
  }
}

export async function issueRewriteToken(
  deviceHash: string,
  store: ResumeAccessStore,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await store.saveToken(digest(token), deviceHash, 2 * 60 * 60);
  return token;
}

export async function consumeRewriteToken(
  token: string,
  deviceHash: string,
  store: ResumeAccessStore,
): Promise<boolean> {
  return store.consumeToken(digest(token), deviceHash);
}

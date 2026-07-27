import { createClient, type RedisClientType } from "redis";

import type { AccessLimits, RateLimitStore } from "./check-access";
import type {
  CommentRateLimits,
  CommentRateLimitStore,
} from "@/lib/comments/access";
import type {
  ResumeAccessStore,
  ResumePlanLimits,
} from "@/lib/resume-workbench/access";
import type { OccupationCorrectionStore } from "@/lib/analysis/correction";

const RATE_LIMIT_SCRIPT = `
local cooldown_ttl = redis.call("TTL", KEYS[3])
if cooldown_ttl > 0 then
  return {1, cooldown_ttl}
end

local ip_limit = tonumber(ARGV[1])
local ip_count = tonumber(redis.call("GET", KEYS[1]) or "0")
if ip_limit > 0 and ip_count >= ip_limit then
  return {2, math.max(1, redis.call("TTL", KEYS[1]))}
end

local device_limit = tonumber(ARGV[3])
local device_count = tonumber(redis.call("GET", KEYS[2]) or "0")
if device_limit > 0 and device_count >= device_limit then
  return {3, math.max(1, redis.call("TTL", KEYS[2]))}
end

local global_count = tonumber(redis.call("GET", KEYS[4]) or "0")
if global_count >= tonumber(ARGV[6]) then
  return {4, math.max(1, redis.call("TTL", KEYS[4]))}
end

if ip_limit > 0 then
  local new_ip_count = redis.call("INCR", KEYS[1])
  if new_ip_count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[2]) end
end

if device_limit > 0 then
  local new_device_count = redis.call("INCR", KEYS[2])
  if new_device_count == 1 then redis.call("EXPIRE", KEYS[2], ARGV[4]) end
end

local new_global_count = redis.call("INCR", KEYS[4])
if new_global_count == 1 then redis.call("EXPIRE", KEYS[4], ARGV[7]) end

redis.call("SET", KEYS[3], "1", "EX", ARGV[5])
return {0, 0}
`;

const COMMENT_RATE_LIMIT_SCRIPT = `
local cooldown_ttl = redis.call("TTL", KEYS[3])
if cooldown_ttl > 0 then
  return {1, cooldown_ttl}
end

local ip_limit = tonumber(ARGV[1])
local ip_count = tonumber(redis.call("GET", KEYS[1]) or "0")
if ip_limit > 0 and ip_count >= ip_limit then
  return {2, math.max(1, redis.call("TTL", KEYS[1]))}
end

local device_count = tonumber(redis.call("GET", KEYS[2]) or "0")
if device_count >= tonumber(ARGV[3]) then
  return {3, math.max(1, redis.call("TTL", KEYS[2]))}
end

local new_ip_count = redis.call("INCR", KEYS[1])
if new_ip_count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[2]) end

local new_device_count = redis.call("INCR", KEYS[2])
if new_device_count == 1 then redis.call("EXPIRE", KEYS[2], ARGV[4]) end

redis.call("SET", KEYS[3], "1", "EX", ARGV[5])
return {0, 0}
`;

const CORRECTION_RATE_LIMIT_SCRIPT = `
local cooldown_ttl = redis.call("TTL", KEYS[2])
if cooldown_ttl > 0 then return {1, cooldown_ttl} end

local ip_limit = tonumber(ARGV[1])
local ip_count = tonumber(redis.call("GET", KEYS[1]) or "0")
if ip_limit > 0 and ip_count >= ip_limit then
  return {2, math.max(1, redis.call("TTL", KEYS[1]))}
end

local global_count = tonumber(redis.call("GET", KEYS[3]) or "0")
if global_count >= tonumber(ARGV[4]) then
  return {4, math.max(1, redis.call("TTL", KEYS[3]))}
end

if ip_limit > 0 then
  local new_ip = redis.call("INCR", KEYS[1])
  if new_ip == 1 then redis.call("EXPIRE", KEYS[1], ARGV[2]) end
end
local new_global = redis.call("INCR", KEYS[3])
if new_global == 1 then redis.call("EXPIRE", KEYS[3], ARGV[5]) end
redis.call("SET", KEYS[2], "1", "EX", ARGV[3])
return {0, 0}
`;

const RESUME_PLAN_LIMIT_SCRIPT = `
local cooldown_ttl = redis.call("TTL", KEYS[3])
if cooldown_ttl > 0 then return {1, cooldown_ttl} end

local ip_count = tonumber(redis.call("GET", KEYS[1]) or "0")
if ip_count >= tonumber(ARGV[1]) then
  return {2, math.max(1, redis.call("TTL", KEYS[1]))}
end

local device_count = tonumber(redis.call("GET", KEYS[2]) or "0")
if device_count >= tonumber(ARGV[3]) then
  return {3, math.max(1, redis.call("TTL", KEYS[2]))}
end

local global_count = tonumber(redis.call("GET", KEYS[4]) or "0")
if global_count >= tonumber(ARGV[6]) then
  return {4, math.max(1, redis.call("TTL", KEYS[4]))}
end

local new_ip = redis.call("INCR", KEYS[1])
if new_ip == 1 then redis.call("EXPIRE", KEYS[1], ARGV[2]) end
local new_device = redis.call("INCR", KEYS[2])
if new_device == 1 then redis.call("EXPIRE", KEYS[2], ARGV[4]) end
local new_global = redis.call("INCR", KEYS[4])
if new_global == 1 then redis.call("EXPIRE", KEYS[4], ARGV[4]) end
redis.call("SET", KEYS[3], "1", "EX", ARGV[5])
return {0, 0}
`;

const CONSUME_REWRITE_TOKEN_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if not value or value ~= ARGV[1] then return 0 end
redis.call("DEL", KEYS[1])
return 1
`;

const CLAIM_CORRECTION_TOKEN_SCRIPT = `
local available = "available:" .. ARGV[1]
local claimed = "claimed:" .. ARGV[1] .. ":" .. ARGV[2]
local value = redis.call("GET", KEYS[1])
if value and string.sub(value, 1, 8) == "claimed:" and redis.call("EXISTS", KEYS[2]) == 0 then
  redis.call("SET", KEYS[1], available, "KEEPTTL")
  value = available
end
if value ~= available then return 0 end
redis.call("SET", KEYS[1], claimed, "KEEPTTL")
redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])
return 1
`;

const COMPLETE_CORRECTION_TOKEN_SCRIPT = `
local claimed = "claimed:" .. ARGV[1] .. ":" .. ARGV[2]
if redis.call("GET", KEYS[1]) ~= claimed then return 0 end
redis.call("DEL", KEYS[1], KEYS[2])
return 1
`;

const RELEASE_CORRECTION_TOKEN_SCRIPT = `
local claimed = "claimed:" .. ARGV[1] .. ":" .. ARGV[2]
if redis.call("GET", KEYS[1]) == claimed then
  redis.call("SET", KEYS[1], "available:" .. ARGV[1], "KEEPTTL")
end
redis.call("DEL", KEYS[2])
return 1
`;

let client: RedisClientType | null = null;
let connection: Promise<RedisClientType> | null = null;

async function getClient(): Promise<RedisClientType> {
  if (client?.isReady) {
    return client;
  }
  if (!connection) {
    client = createClient({ url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379" });
    connection = client.connect().then(() => client as RedisClientType);
  }
  try {
    return await connection;
  } catch (error) {
    connection = null;
    client = null;
    throw error;
  }
}

export const redisRateLimitStore: RateLimitStore = {
  async evaluate(keys: string[], limits: AccessLimits): Promise<[number, number]> {
    const redis = await getClient();
    const result = await redis.eval(RATE_LIMIT_SCRIPT, {
      keys,
      arguments: [
        String(limits.ipLimit),
        String(limits.ipWindowSeconds),
        String(limits.deviceLimit),
        String(limits.deviceWindowSeconds),
        String(limits.cooldownSeconds),
        String(limits.globalLimit),
        String(limits.globalWindowSeconds),
      ],
    });

    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      typeof result[0] !== "number" ||
      typeof result[1] !== "number"
    ) {
      throw new Error("Redis returned an invalid rate-limit result");
    }
    return [result[0], result[1]];
  },

  async evaluateCorrection(
    keys: string[],
    limits: AccessLimits,
  ): Promise<[number, number]> {
    const redis = await getClient();
    const result = await redis.eval(CORRECTION_RATE_LIMIT_SCRIPT, {
      keys,
      arguments: [
        String(limits.ipLimit),
        String(limits.ipWindowSeconds),
        String(limits.cooldownSeconds),
        String(limits.globalLimit),
        String(limits.globalWindowSeconds),
      ],
    });
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      typeof result[0] !== "number" ||
      typeof result[1] !== "number"
    ) {
      throw new Error("Redis returned an invalid correction limit result");
    }
    return [result[0], result[1]];
  },
};

function correctionKeys(tokenHash: string): [string, string] {
  const base = `offerlens:occupation-correction:${tokenHash}`;
  return [base, `${base}:lease`];
}

export const redisOccupationCorrectionStore: OccupationCorrectionStore = {
  async saveToken(tokenHash, deviceHash, ttlSeconds) {
    const redis = await getClient();
    await redis.set(
      correctionKeys(tokenHash)[0],
      `available:${deviceHash}`,
      { expiration: { type: "EX", value: ttlSeconds } },
    );
  },

  async claimToken(tokenHash, deviceHash, claimId, leaseSeconds) {
    const redis = await getClient();
    const result = await redis.eval(CLAIM_CORRECTION_TOKEN_SCRIPT, {
      keys: correctionKeys(tokenHash),
      arguments: [deviceHash, claimId, String(leaseSeconds)],
    });
    return result === 1;
  },

  async completeToken(tokenHash, deviceHash, claimId) {
    const redis = await getClient();
    const result = await redis.eval(COMPLETE_CORRECTION_TOKEN_SCRIPT, {
      keys: correctionKeys(tokenHash),
      arguments: [deviceHash, claimId],
    });
    return result === 1;
  },

  async releaseToken(tokenHash, deviceHash, claimId) {
    const redis = await getClient();
    await redis.eval(RELEASE_CORRECTION_TOKEN_SCRIPT, {
      keys: correctionKeys(tokenHash),
      arguments: [deviceHash, claimId],
    });
  },
};

export const redisCommentRateLimitStore: CommentRateLimitStore = {
  async evaluate(
    keys: string[],
    limits: CommentRateLimits,
  ): Promise<[number, number]> {
    const redis = await getClient();
    const result = await redis.eval(COMMENT_RATE_LIMIT_SCRIPT, {
      keys,
      arguments: [
        String(limits.ipLimit),
        String(limits.ipWindowSeconds),
        String(limits.deviceLimit),
        String(limits.deviceWindowSeconds),
        String(limits.cooldownSeconds),
      ],
    });

    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      typeof result[0] !== "number" ||
      typeof result[1] !== "number"
    ) {
      throw new Error("Redis returned an invalid comment rate-limit result");
    }
    return [result[0], result[1]];
  },
};

export const redisResumeAccessStore: ResumeAccessStore = {
  async evaluatePlan(
    keys: string[],
    limits: ResumePlanLimits,
  ): Promise<[number, number]> {
    const redis = await getClient();
    const result = await redis.eval(RESUME_PLAN_LIMIT_SCRIPT, {
      keys,
      arguments: [
        String(limits.ipLimit),
        String(limits.ipWindowSeconds),
        String(limits.deviceLimit),
        String(limits.deviceWindowSeconds),
        String(limits.cooldownSeconds),
        String(limits.globalLimit),
      ],
    });
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      typeof result[0] !== "number" ||
      typeof result[1] !== "number"
    ) {
      throw new Error("Redis returned an invalid resume limit result");
    }
    return [result[0], result[1]];
  },

  async saveToken(tokenHash, deviceHash, ttlSeconds) {
    const redis = await getClient();
    await redis.set(`offerlens:resume:token:${tokenHash}`, deviceHash, {
      expiration: { type: "EX", value: ttlSeconds },
    });
  },

  async consumeToken(tokenHash, deviceHash) {
    const redis = await getClient();
    const result = await redis.eval(CONSUME_REWRITE_TOKEN_SCRIPT, {
      keys: [`offerlens:resume:token:${tokenHash}`],
      arguments: [deviceHash],
    });
    return result === 1;
  },
};

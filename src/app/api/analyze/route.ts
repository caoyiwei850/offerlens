import { randomBytes } from "node:crypto";
import { ZodError } from "zod";

import {
  checkAnalyzeAccess,
  checkAnalyzeCorrectionAccess,
  type AccessDecision,
  type AccessIdentity,
} from "@/lib/access/check-access";
import {
  redisOccupationCorrectionStore,
  redisRateLimitStore,
} from "@/lib/access/redis-store";
import { simulateHiringFlow, type ModelCall } from "@/lib/analysis/simulate-hiring-flow";
import { callDeepSeek } from "@/lib/analysis/deepseek";
import {
  claimOccupationCorrection,
  completeOccupationCorrection,
  issueOccupationCorrection,
  releaseOccupationCorrection,
  type OccupationCorrectionStore,
} from "@/lib/analysis/correction";
import { occupationFamilySchema } from "@/lib/analysis/occupation";
import { parseResumeInput } from "@/lib/resume/parse-resume";

export const runtime = "nodejs";

interface AnalyzeDependencies {
  callModel: ModelCall;
  checkAccess: (identity: AccessIdentity) => Promise<AccessDecision>;
  checkCorrectionAccess: (identity: AccessIdentity) => Promise<AccessDecision>;
  correctionStore: OccupationCorrectionStore;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  retryAfter?: number,
): Response {
  return Response.json(
    { error: { code, message, ...(retryAfter ? { retryAfter } : {}) } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}

function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;

  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }
  return undefined;
}

function readString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function summarizeAnalysisError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.join("."),
      message: issue.message,
    }));
  }
  if (error instanceof SyntaxError) {
    return { code: "INVALID_JSON", message: "模型返回的 JSON 无法解析" };
  }
  return { code: "MODEL_FAILURE", message: "模型调用或结果校验失败" };
}

export function createAnalyzeHandler(dependencies: AnalyzeDependencies) {
  return async function handleAnalyze(request: Request): Promise<Response> {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return errorResponse(400, "INVALID_INPUT", "请求格式无效");
    }

    const deviceId = readString(form, "deviceId");
    const fingerprint = readString(form, "fingerprint");
    const cookieDeviceId = readCookie(request, "offerlens_device_id");
    if (
      !isDigest(deviceId) ||
      !isDigest(fingerprint) ||
      cookieDeviceId !== deviceId
    ) {
      return errorResponse(400, "INVALID_DEVICE", "设备标识无效，请刷新页面后重试");
    }

    const jd = readString(form, "jd");
    if (!jd) {
      return errorResponse(400, "INVALID_INPUT", "请输入目标岗位描述");
    }
    if (jd.length > 5_000) {
      return errorResponse(400, "INVALID_INPUT", "岗位描述不能超过 5,000 字符");
    }

    const occupationValue = readString(form, "occupationFamily");
    const occupationOverride =
      occupationValue && occupationValue !== "AUTO"
        ? occupationFamilySchema.safeParse(occupationValue)
        : null;
    if (occupationOverride && !occupationOverride.success) {
      return errorResponse(400, "INVALID_INPUT", "请选择有效的职业领域");
    }
    const correctionToken = readString(form, "correctionToken");
    if (correctionToken && (!occupationOverride || !occupationOverride.success)) {
      return errorResponse(
        400,
        "INVALID_INPUT",
        "纠正职业领域时必须选择具体职业",
      );
    }
    if (correctionToken && !/^[A-Za-z0-9_-]{20,200}$/.test(correctionToken)) {
      return errorResponse(400, "INVALID_INPUT", "职业纠正凭证无效");
    }

    const ip = request.headers.get("x-real-ip")?.trim();
    if (!ip && process.env.NODE_ENV === "production") {
      return errorResponse(503, "ACCESS_UNAVAILABLE", "访问控制暂时不可用");
    }

    const fileValue = form.get("resumeFile");
    const resumeFile = fileValue instanceof File && fileValue.size > 0 ? fileValue : undefined;
    let resume: string;
    try {
      resume = await parseResumeInput({
        resumeText: readString(form, "resumeText"),
        resumeFile,
      });
    } catch (error) {
      return errorResponse(
        400,
        "INVALID_INPUT",
        error instanceof Error ? error.message : "简历内容无效",
      );
    }

    const identity = {
      ip: ip || "127.0.0.1",
      deviceId,
      fingerprint,
    };
    const claimId = randomBytes(16).toString("hex");
    let correctionClaimed = false;
    if (correctionToken) {
      try {
        correctionClaimed = await claimOccupationCorrection(
          correctionToken,
          claimId,
          identity,
          dependencies.correctionStore,
        );
      } catch {
        return errorResponse(503, "ACCESS_UNAVAILABLE", "职业纠正暂时不可用");
      }
      if (!correctionClaimed) {
        return errorResponse(
          409,
          "CORRECTION_EXPIRED",
          "本次免费纠正已失效，请重新发起分析",
        );
      }
    }

    let decision: AccessDecision;
    try {
      decision = correctionToken
        ? await dependencies.checkCorrectionAccess(identity)
        : await dependencies.checkAccess(identity);
    } catch {
      if (correctionClaimed) {
        await releaseOccupationCorrection(
          correctionToken,
          claimId,
          identity,
          dependencies.correctionStore,
        ).catch(() => undefined);
      }
      return errorResponse(503, "ACCESS_UNAVAILABLE", "访问控制暂时不可用");
    }
    if (!decision.allowed) {
      if (correctionClaimed) {
        await releaseOccupationCorrection(
          correctionToken,
          claimId,
          identity,
          dependencies.correctionStore,
        ).catch(() => undefined);
      }
      return errorResponse(
        429,
        "RATE_LIMITED",
        decision.reason === "cooldown"
          ? "操作太快，请稍后再试"
          : "今日分析次数已用完，请稍后再试",
        decision.retryAfter,
      );
    }

    try {
      const analysis = await simulateHiringFlow(
        {
          resume,
          jd,
          ...(occupationOverride?.success
            ? { occupationOverride: occupationOverride.data }
            : {}),
        },
        dependencies.callModel,
      );
      if (correctionClaimed) {
        const completed = await completeOccupationCorrection(
          correctionToken,
          claimId,
          identity,
          dependencies.correctionStore,
        );
        if (!completed) {
          return errorResponse(
            503,
            "ACCESS_UNAVAILABLE",
            "职业纠正状态确认失败，请稍后重试",
          );
        }
      }
      const correction =
        !occupationOverride?.success && !correctionToken
          ? await issueOccupationCorrection(
              identity,
              dependencies.correctionStore,
            ).catch(() => null)
          : null;
      return Response.json({ ...analysis, correction }, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (correctionClaimed) {
        await releaseOccupationCorrection(
          correctionToken,
          claimId,
          identity,
          dependencies.correctionStore,
        ).catch(() => undefined);
      }
      console.error(
        "[analyze] invalid model response",
        summarizeAnalysisError(error),
      );
      return errorResponse(502, "MODEL_ERROR", "分析结果生成失败，请稍后重试");
    }
  };
}

const defaultCallModel: ModelCall = async (input) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  return callDeepSeek(input, {
    apiKey,
    thinkingEnabled: process.env.DEEPSEEK_THINKING_ENABLED === "true",
    timeoutMs: 45_000,
  });
};

export const POST = createAnalyzeHandler({
  callModel: defaultCallModel,
  checkAccess: (identity) => checkAnalyzeAccess(identity, redisRateLimitStore),
  checkCorrectionAccess: (identity) =>
    checkAnalyzeCorrectionAccess(identity, redisRateLimitStore),
  correctionStore: redisOccupationCorrectionStore,
});

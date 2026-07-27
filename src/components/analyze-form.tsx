"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import {
  analyzeResponseSchema,
  hiringSimulationSchema,
} from "@/lib/analysis/types";
import {
  OCCUPATION_OPTIONS,
  type OccupationFamily,
} from "@/lib/analysis/occupation";
import { getDeviceIdentity } from "@/lib/client/device-identity";
import {
  loadReusableAnalysisSnapshot,
  saveAnalysisSnapshot,
} from "@/lib/client/result-storage";
import {
  loadResumeWorkspace,
  saveResumeWorkspace,
} from "@/lib/client/resume-workspace";
import { clearResumeWorkbenchState } from "@/lib/client/resume-workbench-state";
import {
  trackAnalytics,
  trackAnalyticsOnce,
} from "@/lib/client/analytics";
import { Disclaimer } from "./disclaimer";

const ACCEPTED_FILES =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fileInputMode(file: File | null): "TEXT" | "PDF" | "DOCX" {
  if (!file) return "TEXT";
  return file.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF";
}

export function AnalyzeForm() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [occupationFamily, setOccupationFamily] = useState<
    "AUTO" | OccupationFamily
  >("AUTO");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackAnalyticsOnce("landing", "LANDING_VIEWED", {});
    const workspace = loadResumeWorkspace();
    if (workspace) {
      queueMicrotask(() => {
        setResumeText(workspace.resumeText);
        setJd(workspace.jd);
        setOccupationFamily(workspace.occupationFamily ?? "AUTO");
      });
    }
  }, []);

  function handleResumeText(value: string) {
    setResumeText(value);
    if (value && resumeFile) {
      setResumeFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!resumeText.trim() && !resumeFile) {
      setError("请粘贴或上传一份简历");
      return;
    }
    if (!jd.trim()) {
      setError("请输入目标岗位的招聘要求");
      return;
    }

    const startedAt = Date.now();
    const inputMode = fileInputMode(resumeFile);
    let errorCode = "CLIENT_ERROR";
    trackAnalytics("ANALYSIS_STARTED", { inputMode });
    setLoading(true);
    try {
      const identity = await getDeviceIdentity();
      let normalizedResume = resumeText.trim();
      if (resumeFile) {
        const extraction = new FormData();
        extraction.set("resumeFile", resumeFile);
        const extractionResponse = await fetch("/api/resume/extract", {
          method: "POST",
          body: extraction,
        });
        const extractionPayload = (await extractionResponse.json()) as {
          resumeText?: string;
          error?: { code?: string; message?: string };
        };
        if (!extractionResponse.ok || !extractionPayload.resumeText) {
          errorCode = extractionPayload.error?.code || "EXTRACTION_FAILED";
          throw new Error(
            extractionPayload.error?.message || "简历文件读取失败",
          );
        }
        normalizedResume = extractionPayload.resumeText;
      }

      const cached = loadReusableAnalysisSnapshot({
        resumeText: normalizedResume,
        jd: jd.trim(),
        occupationFamily,
      });
      if (cached) {
        saveAnalysisSnapshot({
          resumeText: normalizedResume,
          jd: jd.trim(),
          occupationFamily,
          analysis: cached.analysis,
          correction: cached.correction,
        });
        saveResumeWorkspace({
          resumeText: normalizedResume,
          jd: jd.trim(),
          occupationFamily,
        });
        clearResumeWorkbenchState();
        trackAnalytics("ANALYSIS_SUCCEEDED", {
          inputMode,
          result: cached.analysis.final_result,
          applicationStatus: cached.analysis.application_status,
          occupationFamily: cached.analysis.evaluation_context.occupation_family,
          durationMs: Math.min(Date.now() - startedAt, 10 * 60 * 1000),
        });
        router.push("/result");
        return;
      }

      const form = new FormData();
      form.set("resumeText", normalizedResume);
      form.set("jd", jd);
      form.set("deviceId", identity.deviceId);
      form.set("fingerprint", identity.fingerprint);
      if (occupationFamily !== "AUTO") {
        form.set("occupationFamily", occupationFamily);
      }

      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const apiError = payload as {
          error?: { code?: string; message?: string };
        };
        errorCode = apiError.error?.code || "ANALYSIS_FAILED";
        throw new Error(apiError.error?.message || "分析失败，请稍后重试");
      }

      const apiResult = analyzeResponseSchema.parse(payload);
      const { correction, ...analysisPayload } = apiResult;
      const analysis = hiringSimulationSchema.parse(analysisPayload);
      saveAnalysisSnapshot({
        resumeText: normalizedResume,
        jd: jd.trim(),
        occupationFamily,
        analysis,
        correction,
      });
      saveResumeWorkspace({
        resumeText: normalizedResume,
        jd: jd.trim(),
        occupationFamily,
      });
      clearResumeWorkbenchState();
      trackAnalytics("ANALYSIS_SUCCEEDED", {
        inputMode,
        result: analysis.final_result,
        applicationStatus: analysis.application_status,
        occupationFamily: analysis.evaluation_context.occupation_family,
        durationMs: Math.min(Date.now() - startedAt, 10 * 60 * 1000),
      });
      router.push("/result");
    } catch (cause) {
      trackAnalytics("ANALYSIS_FAILED", {
        inputMode,
        errorCode: /^[A-Z0-9_]{2,64}$/.test(errorCode)
          ? errorCode
          : "ANALYSIS_FAILED",
        durationMs: Math.min(Date.now() - startedAt, 10 * 60 * 1000),
      });
      setError(cause instanceof Error ? cause.message : "分析失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur md:p-8"
    >
      <div className="mb-7 flex flex-col justify-between gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-emerald-600">开始一次模拟决策</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">把真实材料交给“招聘负责人”</h2>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
          约 30–45 秒
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="resume" className="text-sm font-semibold text-slate-800">
              粘贴简历内容
            </label>
            <span className="text-xs tabular-nums text-slate-400">{resumeText.length}/8000</span>
          </div>
          <textarea
            id="resume"
            value={resumeText}
            maxLength={8000}
            onChange={(event) => handleResumeText(event.target.value)}
            placeholder="建议保留工作、实习、实践、职责、成果和技能信息…"
            className="min-h-56 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />

          <div className="my-3 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            或上传文件
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <label
            htmlFor="resume-file"
            className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 px-4 py-3 transition hover:border-emerald-400 hover:bg-emerald-50/50"
          >
            <span>
              <span className="block text-sm font-medium text-slate-700">
                {resumeFile?.name || "选择 PDF 或 DOCX 简历"}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">最大 10 MB，不会保存原文件</span>
            </span>
            <span className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
              上传
            </span>
          </label>
          <input
            ref={fileInputRef}
            id="resume-file"
            aria-label="上传 PDF 或 DOCX 简历"
            type="file"
            accept={ACCEPTED_FILES}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setResumeFile(file);
              if (file) setResumeText("");
            }}
          />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="jd" className="text-sm font-semibold text-slate-800">
              目标岗位描述
            </label>
            <span className="text-xs tabular-nums text-slate-400">{jd.length}/5000</span>
          </div>
          <textarea
            id="jd"
            value={jd}
            maxLength={5000}
            onChange={(event) => setJd(event.target.value)}
            placeholder="粘贴完整岗位职责、任职要求和加分项…"
            className="min-h-[342px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />
          <div className="mt-4">
            <label
              htmlFor="occupation-family"
              className="text-sm font-semibold text-slate-800"
            >
              职业领域
            </label>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              默认由 AI 根据岗位描述识别；如果你明确知道职业方向，也可以直接指定。
            </p>
            <select
              id="occupation-family"
              value={occupationFamily}
              onChange={(event) =>
                setOccupationFamily(
                  event.target.value as "AUTO" | OccupationFamily,
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="AUTO">自动识别（推荐）</option>
              {OCCUPATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer />
        <button
          type="submit"
          disabled={loading || !hydrated}
          className="inline-flex min-w-40 items-center justify-center rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "正在模拟招聘流程…" : hydrated ? "开始模拟" : "正在准备…"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";

import {
  OCCUPATION_FAMILY_LABELS,
  OCCUPATION_OPTIONS,
  type OccupationFamily,
} from "@/lib/analysis/occupation";
import {
  analyzeResponseSchema,
  hiringSimulationSchema,
  type EvaluationContext,
  type OccupationCorrection,
} from "@/lib/analysis/types";
import { getDeviceIdentity } from "@/lib/client/device-identity";
import {
  saveAnalysisResult,
  saveOccupationCorrection,
} from "@/lib/client/result-storage";
import { clearResumeWorkbenchState } from "@/lib/client/resume-workbench-state";
import {
  loadResumeWorkspace,
  saveResumeWorkspace,
} from "@/lib/client/resume-workspace";

export function OccupationCorrectionControl({
  context,
  correction,
  onCorrected,
}: {
  context: EvaluationContext;
  correction: OccupationCorrection | null;
  onCorrected?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<OccupationFamily>(
    context.occupation_family,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!correction || context.occupation_source !== "AUTO") return null;
  const correctionToken = correction.token;

  async function submitCorrection() {
    const workspace = loadResumeWorkspace();
    if (!workspace) {
      setError("当前标签页没有原始材料，请返回首页重新提交");
      return;
    }
    if (family === context.occupation_family) {
      setError("请选择不同的职业领域");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const identity = await getDeviceIdentity();
      const form = new FormData();
      form.set("resumeText", workspace.resumeText);
      form.set("jd", workspace.jd);
      form.set("deviceId", identity.deviceId);
      form.set("fingerprint", identity.fingerprint);
      form.set("occupationFamily", family);
      form.set("correctionToken", correctionToken);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const apiError = payload as { error?: { message?: string } };
        throw new Error(apiError.error?.message || "职业领域纠正失败");
      }
      const apiResult = analyzeResponseSchema.parse(payload);
      const { correction: nextCorrection, ...analysisPayload } = apiResult;
      saveAnalysisResult(hiringSimulationSchema.parse(analysisPayload));
      saveOccupationCorrection(nextCorrection);
      saveResumeWorkspace({
        resumeText: workspace.resumeText,
        jd: workspace.jd,
        occupationFamily: family,
      });
      clearResumeWorkbenchState();
      onCorrected?.();
      if (!onCorrected) window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "职业领域纠正失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-sky-100 bg-white/80 p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            AI 识别为：{OCCUPATION_FAMILY_LABELS[context.occupation_family]}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            如果职业领域识别有误，可免费纠正一次，不占设备当天分析次数。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="shrink-0 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700"
        >
          识别不准确？
        </button>
      </div>

      {open ? (
        <div className="mt-4 border-t border-sky-100 pt-4">
          <label
            htmlFor="occupation-correction"
            className="text-sm font-semibold text-slate-700"
          >
            更正职业领域
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <select
              id="occupation-correction"
              value={family}
              onChange={(event) =>
                setFamily(event.target.value as OccupationFamily)
              }
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              {OCCUPATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading}
              onClick={submitCorrection}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "正在重新评测…" : "免费重新评测"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

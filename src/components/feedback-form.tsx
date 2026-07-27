"use client";

import { useEffect, useState, type FormEvent } from "react";

import { OCCUPATION_OPTIONS } from "@/lib/analysis/occupation";
import { trackAnalytics, trackAnalyticsOnce } from "@/lib/client/analytics";
import { getDeviceIdentity } from "@/lib/client/device-identity";
import type {
  FeedbackKind,
  InterviewOutcome,
  PredictionMatch,
} from "@/lib/feedback/types";

const OUTCOMES: Array<{ value: InterviewOutcome; label: string }> = [
  { value: "ONGOING", label: "仍在面试流程中" },
  { value: "OFFERED", label: "已获得 Offer" },
  { value: "REJECTED", label: "这次没有通过" },
  { value: "WITHDREW", label: "我主动放弃了" },
];

const MATCH_OPTIONS: Array<{ value: PredictionMatch; label: string }> = [
  { value: "MATCHED", label: "基本吻合" },
  { value: "PARTLY_MATCHED", label: "部分吻合" },
  { value: "NOT_MATCHED", label: "明显不吻合" },
  { value: "UNSURE", label: "暂时说不准" },
];

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const value = (await response.json()) as { error?: { message?: string } };
    return value.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function FeedbackForm() {
  const [kind, setKind] = useState<FeedbackKind>("INTERVIEW_OUTCOME");
  const [outcome, setOutcome] = useState<InterviewOutcome | "">("");
  const [predictionMatch, setPredictionMatch] = useState<
    PredictionMatch | ""
  >("");
  const [occupationFamily, setOccupationFamily] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    trackAnalyticsOnce("feedback", "FEEDBACK_VIEWED", {});
  }, []);

  function selectKind(value: FeedbackKind) {
    setKind(value);
    setError("");
    setStatus("");
    if (value === "PRODUCT_SUGGESTION") {
      setOutcome("");
      setPredictionMatch("");
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (kind === "INTERVIEW_OUTCOME" && (!outcome || !predictionMatch)) {
      setError("请先选择实际面试进展和判断吻合度");
      return;
    }
    setSubmitting(true);
    try {
      const identity = await getDeviceIdentity();
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ...(kind === "INTERVIEW_OUTCOME"
            ? { outcome, predictionMatch }
            : {}),
          rating,
          content,
          ...(occupationFamily ? { occupationFamily } : {}),
          deviceId: identity.deviceId,
          fingerprint: identity.fingerprint,
        }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "反馈提交失败"));
      }
      await response.json();
      trackAnalytics("FEEDBACK_SUBMITTED", { feedbackKind: kind });
      setContent("");
      setStatus(
        kind === "INTERVIEW_OUTCOME"
          ? "反馈已收到，谢谢你回来告诉我们真实结果。"
          : "建议已收到，谢谢你帮助 OfferLens 继续改进。",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "反馈提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-slate-950 p-7 text-white shadow-[0_30px_90px_rgba(15,23,42,0.22)] md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
          Real Interview Feedback
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
          面试结束了？回来告诉我们真实结果
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          不需要重新上传简历，也不需要再做一次模拟。你的反馈不会公开展示，
          只用于判断哪些建议真正帮助了求职者。
        </p>
      </section>

      <form
        onSubmit={submitFeedback}
        className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur md:p-8"
      >
        <fieldset>
          <legend className="text-base font-bold text-slate-950">
            你这次想反馈什么？
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              {
                value: "INTERVIEW_OUTCOME" as const,
                label: "我已经参加面试",
                detail: "反馈真实进展和模拟判断是否吻合",
              },
              {
                value: "PRODUCT_SUGGESTION" as const,
                label: "我想提产品建议",
                detail: "无需参加面试，也可以直接告诉我们",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={kind === option.value}
                onClick={() => selectKind(option.value)}
                className={`rounded-2xl border p-4 text-left transition ${
                  kind === option.value
                    ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-bold text-slate-900">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {option.detail}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {kind === "INTERVIEW_OUTCOME" ? (
          <div className="mt-7 space-y-7">
            <fieldset>
              <legend className="text-sm font-bold text-slate-800">
                这次面试进展到哪里？
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {OUTCOMES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={outcome === option.value}
                    onClick={() => setOutcome(option.value)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      outcome === option.value
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-bold text-slate-800">
                模拟判断和实际面试吻合吗？
              </legend>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                只有参加过面试后再回答，暂时无法判断可以选择“说不准”。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MATCH_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={predictionMatch === option.value}
                    onClick={() => setPredictionMatch(option.value)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      predictionMatch === option.value
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        <div className="mt-7 grid gap-5 md:grid-cols-[1fr_auto]">
          <label className="text-sm font-bold text-slate-800">
            职业领域（可选）
            <select
              aria-label="职业领域（可选）"
              value={occupationFamily}
              onChange={(event) => setOccupationFamily(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">不填写</option>
              {OCCUPATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-bold text-slate-800">
              这次体验有帮助吗？
            </legend>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} 星`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  className={`grid h-11 w-11 place-items-center rounded-xl text-lg transition ${
                    value <= rating
                      ? "bg-amber-100 text-amber-500"
                      : "bg-slate-100 text-slate-300"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="mt-6 block text-sm font-bold text-slate-800">
          反馈内容
          <textarea
            aria-label="反馈内容"
            value={content}
            minLength={2}
            maxLength={500}
            required
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              kind === "INTERVIEW_OUTCOME"
                ? "实际面试重点是什么？哪些模拟判断吻合或不吻合？"
                : "你希望 OfferLens 哪里做得更清楚、更省事？"
            }
            className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-400">
            请勿填写姓名、联系方式、公司机密、完整简历或岗位描述。
            <span className="ml-2 tabular-nums">{content.length}/500</span>
          </p>
          <button
            type="submit"
            disabled={submitting || content.trim().length < 2}
            className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "正在提交…" : "提交反馈"}
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}
        <p
          aria-live="polite"
          className="mt-4 min-h-5 text-sm font-medium text-emerald-700"
        >
          {status}
        </p>
      </form>
    </div>
  );
}

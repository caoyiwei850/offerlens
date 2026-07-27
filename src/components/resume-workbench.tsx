"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getDeviceIdentity } from "@/lib/client/device-identity";
import {
  trackAnalytics,
  trackAnalyticsOnce,
} from "@/lib/client/analytics";
import { loadAnalysisResult } from "@/lib/client/result-storage";
import {
  loadResumeWorkbenchState,
  saveResumeWorkbenchState,
} from "@/lib/client/resume-workbench-state";
import {
  loadResumeWorkspace,
  saveResumeWorkspace,
} from "@/lib/client/resume-workspace";
import { RESUME_TEMPLATES } from "@/lib/resume-workbench/templates";
import { serializeResumeDraft } from "@/lib/resume-workbench/serialize";
import { completedQuestionIds } from "@/lib/resume-workbench/guidance";
import type {
  ConsistencyIssue,
  EvidenceAnswer,
  GapQuestion,
  ResumeBullet,
  ResumeDraft,
  ResumePlanResponse,
  ResumeRewriteResponse,
  TemplateId,
} from "@/lib/resume-workbench/types";
import {
  resumePlanResponseSchema,
  resumeRewriteRequestSchema,
  resumeRewriteResponseSchema,
} from "@/lib/resume-workbench/types";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const value = (await response.json()) as { error?: { message?: string } };
    return value.error?.message || fallback;
  } catch {
    return fallback;
  }
}

function findBullet(draft: ResumeDraft, id: string): ResumeBullet | undefined {
  return [
    ...draft.experiences.flatMap((item) => item.bullets),
    ...draft.projects.flatMap((item) => item.bullets),
  ].find((bullet) => bullet.id === id);
}

function replaceBullet(
  draft: ResumeDraft,
  id: string,
  update: (bullet: ResumeBullet) => ResumeBullet,
): ResumeDraft {
  return {
    ...draft,
    experiences: draft.experiences.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet) =>
        bullet.id === id ? update(bullet) : bullet,
      ),
    })),
    projects: draft.projects.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet) =>
        bullet.id === id ? update(bullet) : bullet,
      ),
    })),
  };
}

function EvidenceQuestionCard({
  question,
  answer,
  complete,
  highlighted,
  onChange,
  register,
}: {
  question: GapQuestion;
  answer?: EvidenceAnswer;
  complete: boolean;
  highlighted: boolean;
  onChange: (answer: EvidenceAnswer) => void;
  register: (element: HTMLDivElement | null) => void;
}) {
  const detailLength = answer?.detail?.length ?? 0;
  const direct = question.answerMode === "DIRECT_CONFIRMATION";
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const expanded =
    highlighted ||
    manuallyExpanded ||
    (!complete && (question.required || answer?.status === "HAS_EVIDENCE"));
  const visibleSources = question.possibleSources.slice(0, 3);
  const hiddenSources = question.possibleSources.slice(3);

  function choose(status: EvidenceAnswer["status"]) {
    setManuallyExpanded(true);
    onChange(
      status === "HAS_EVIDENCE"
        ? {
            questionId: question.id,
            status,
            detail: answer?.detail || "",
          }
        : { questionId: question.id, status },
    );
  }

  function update(value: string) {
    onChange({
      questionId: question.id,
      status: "HAS_EVIDENCE",
      detail: value,
    });
  }

  return (
    <div
      ref={register}
      tabIndex={-1}
      className={`rounded-2xl border p-4 outline-none transition ${
        highlighted
          ? "border-red-300 bg-red-50 ring-2 ring-red-100"
          : complete
            ? "border-emerald-200 bg-emerald-50/40"
            : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-700">
            {direct ? "需要确认" : "补充证据"}
          </p>
          <h3 className="mt-1 text-base font-bold leading-6 text-slate-950">
            {question.employerNeed}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              complete
                ? "bg-emerald-100 text-emerald-700"
                : question.required
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {complete ? "已补充" : question.required ? "必填" : "可选"}
          </span>
          {complete || !question.required ? (
            <button
              type="button"
              onClick={() => setManuallyExpanded((value) => !value)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              {expanded ? "收起" : complete ? "修改" : "展开"}
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">
        {question.prompt}
      </p>

      {complete && !expanded ? (
        <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-emerald-800">
          已记录为真实补充。需要调整时点右侧“修改”。
        </p>
      ) : null}

      {!expanded ? null : (
        <>
          <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-700">
              为什么问这个
            </summary>
            <p className="mt-2">
              {question.reason} {question.whyItMatters}
            </p>
          </details>

          <div className="mt-3 flex flex-wrap gap-2">
            {visibleSources.map((source) => (
              <span
                key={source}
                className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs text-sky-800"
              >
                {source}
              </span>
            ))}
            {hiddenSources.length ? (
              <details>
                <summary className="cursor-pointer list-none rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                  更多提示
                </summary>
                <div className="mt-2 flex max-w-xl flex-wrap gap-2 rounded-xl bg-sky-50 p-3">
                  {hiddenSources.map((source) => (
                    <span
                      key={source}
                      className="rounded-full bg-white px-2.5 py-1 text-xs text-sky-800"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(
          [
            ["HAS_EVIDENCE", direct ? "我来说明真实情况" : "我有类似经历"],
            [
              "NO_EVIDENCE",
              direct ? "没有可核对材料" : "暂时没有",
            ],
            ["UNSURE", direct ? "暂时无法确认" : "不确定"],
          ] as const
        ).map(([status, label]) => (
          <button
            key={status}
            type="button"
            onClick={() => choose(status)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              answer?.status === status
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {answer?.status === "HAS_EVIDENCE" ? (
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">
            {direct ? "请说明真实情况和需要修正的内容" : "请描述这段经历的背景、你的角色、具体行动和结果"}
            <textarea
              aria-label={direct ? "请说明真实情况和需要修正的内容" : "请描述这段经历的背景、你的角色、具体行动和结果"}
              maxLength={1000}
              value={answer?.detail || ""}
              onChange={(event) => update(event.target.value)}
              className="mt-1 min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400"
            />
          </label>
          <p className="mt-2 text-xs text-slate-400">
            已填写 {detailLength}/1000 字。只写真实发生的内容，留空比编造更安全。
          </p>
        </div>
      ) : null}
      {answer?.status === "NO_EVIDENCE" ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {direct
            ? "这项信息仍未说明清楚，AI 不会猜测或替你修改。"
            : "已记录为暂时没有。AI 不会把上面的回忆提示写进简历。"}
        </p>
      ) : null}
      {answer?.status === "UNSURE" ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {direct
            ? "请核对真实时间或经历性质后再继续生成。"
            : "已保留为待完善，本次不会写进最终简历。"}
        </p>
      ) : null}
        </>
      )}
    </div>
  );
}

function TemplatePreview({
  draft,
  template,
}: {
  draft: ResumeDraft;
  template: TemplateId;
}) {
  const tokens = RESUME_TEMPLATES[template];
  const sectionLabels = {
    summary: "个人简介",
    skills: "专业技能",
    experience: "工作与实习经历",
    projects: "项目经历",
    education: "教育经历",
    certificates: "证书与补充信息",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-center">
        <p className="text-xl font-black text-slate-950">
          {draft.basics.name || draft.basics.targetRole || "未命名简历"}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {[
            draft.basics.phone,
            draft.basics.email,
            draft.basics.location,
            draft.basics.targetRole,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {tokens.sectionOrder.map((section) => (
          <div key={section}>
            <p className="border-b border-slate-200 pb-1 text-xs font-bold text-emerald-700">
              {sectionLabels[section]}
            </p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
              {section === "summary"
                ? draft.basics.summary
                : section === "skills"
                  ? draft.skills.join("、")
                  : section === "experience"
                    ? draft.experiences
                        .flatMap((item) => item.bullets.map((bullet) => bullet.text))
                        .join(" ")
                    : section === "projects"
                      ? draft.projects
                          .flatMap((item) => item.bullets.map((bullet) => bullet.text))
                          .join(" ")
                      : section === "education"
                        ? draft.education
                            .map((item) =>
                              [item.school, item.degree, item.major]
                                .filter(Boolean)
                                .join(" "),
                            )
                            .join(" ")
                        : draft.certificates.join("、")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResumeWorkbench() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<ResumePlanResponse | null>(null);
  const [rewritten, setRewritten] = useState<ResumeRewriteResponse | null>(null);
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [template, setTemplate] = useState<TemplateId>("EXPERIENCE");
  const [answers, setAnswers] = useState<Record<string, EvidenceAnswer>>({});
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
  const [factsConfirmed, setFactsConfirmed] = useState(false);
  const [highlightedQuestion, setHighlightedQuestion] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const questionElements = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const saved = loadResumeWorkbenchState();
    queueMicrotask(() => {
      if (saved) {
        setPlan(saved.plan);
        setRewritten(saved.rewritten);
        setDraft(saved.draft);
        setTemplate(saved.template);
        setAnswers(saved.answers);
        setIssues(saved.rewritten?.unresolvedIssues ?? saved.plan.issues);
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (plan && draft) {
      saveResumeWorkbenchState({
        plan,
        rewritten,
        draft,
        template,
        answers,
      });
    }
  }, [plan, rewritten, draft, template, answers]);

  const workspace = ready ? loadResumeWorkspace() : null;
  const analysis = ready ? loadAnalysisResult() : null;
  useEffect(() => {
    if (!ready || !workspace || !analysis) return;
    trackAnalyticsOnce("resume-workbench", "RESUME_WORKBENCH_VIEWED", {
      occupationFamily: analysis.evaluation_context.occupation_family,
      result: analysis.final_result,
      applicationStatus: analysis.application_status,
    });
  }, [ready, workspace, analysis]);
  const blocking = issues.some(
    (issue) => issue.severity === "BLOCKING" && !issue.resolved,
  );
  const needsInput =
    draft?.experiences.some((entry) =>
      entry.bullets.some((bullet) => bullet.status === "NEEDS_INPUT"),
    ) ||
    draft?.projects.some((entry) =>
      entry.bullets.some((bullet) => bullet.status === "NEEDS_INPUT"),
    ) ||
    false;
  const completedQuestions = useMemo(
    () =>
      plan
        ? completedQuestionIds(plan.questions, Object.values(answers))
        : new Set<string>(),
    [plan, answers],
  );
  const missingRequired =
    plan?.questions.filter(
      (question) => question.required && !completedQuestions.has(question.id),
    ) ?? [];

  async function createPlan() {
    if (!workspace || !analysis) return;
    setLoading("plan");
    setError("");
    try {
      const identity = await getDeviceIdentity();
      const response = await fetch("/api/resume/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: workspace.resumeText,
          jd: workspace.jd,
          analysis,
          deviceId: identity.deviceId,
          fingerprint: identity.fingerprint,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "规划生成失败"));
      const value = resumePlanResponseSchema.parse(await response.json());
      setPlan(value);
      setDraft(value.draft);
      setTemplate(value.recommendedTemplate);
      setIssues(value.issues);
      setAnswers({});
      setFactsConfirmed(false);
      trackAnalytics("RESUME_PLAN_SUCCEEDED", {
        occupationFamily: analysis.evaluation_context.occupation_family,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "规划生成失败");
    } finally {
      setLoading("");
    }
  }

  async function rewriteResume() {
    if (!plan || !draft) return;
    setError("");
    setHighlightedQuestion("");
    if (missingRequired.length > 0) {
      const first = missingRequired[0];
      setHighlightedQuestion(first.id);
      setError(`还有 ${missingRequired.length} 项需要补充`);
      const element = questionElements.current[first.id];
      if (typeof element?.scrollIntoView === "function") {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      element?.focus();
      return;
    }
    if (!factsConfirmed) {
      setError("请先确认补充内容来自真实经历");
      return;
    }
    setLoading("rewrite");
    try {
      const identity = await getDeviceIdentity();
      const payload = {
        draft: plan.draft,
        facts: plan.facts,
        questions: plan.questions,
        issues,
        answers: Object.values(answers),
        factsConfirmed,
        template,
        rewriteToken: plan.rewriteToken,
        deviceId: identity.deviceId,
        fingerprint: identity.fingerprint,
      };
      const validated = resumeRewriteRequestSchema.safeParse(payload);
      if (!validated.success) {
        const tooLong = validated.error.issues.some(
          (issue) =>
            issue.path[0] === "answers" &&
            (issue.code === "too_big" || /不能超过/.test(issue.message)),
        );
        throw new Error(
          tooLong
            ? "单项补充内容不能超过允许长度"
            : "当前核对清单已过期，请重新生成",
        );
      }
      const response = await fetch("/api/resume/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.data),
      });
      if (!response.ok) throw new Error(await readError(response, "简历改写失败"));
      const value = resumeRewriteResponseSchema.parse(await response.json());
      setRewritten(value);
      setDraft(value.draft);
      setIssues(value.unresolvedIssues);
      trackAnalytics("RESUME_REWRITE_SUCCEEDED", {
        occupationFamily:
          analysis?.evaluation_context.occupation_family,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "简历改写失败");
    } finally {
      setLoading("");
    }
  }

  function updateAnswer(answer: EvidenceAnswer) {
    setAnswers((current) => ({
      ...current,
      [answer.questionId]: answer,
    }));
    setFactsConfirmed(false);
    setHighlightedQuestion("");
    setError("");
  }

  async function exportResume(format: "pdf" | "docx") {
    if (!draft) return;
    setLoading(format);
    setError("");
    try {
      const response = await fetch(`/api/resume/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          template,
          unresolvedIssues: issues,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "导出失败"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${draft.basics.name || "OfferLens"}-简历.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      trackAnalytics("RESUME_EXPORTED", {
        format: format.toUpperCase() as "PDF" | "DOCX",
        occupationFamily:
          analysis?.evaluation_context.occupation_family,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出失败");
    } finally {
      setLoading("");
    }
  }

  function simulateAgain() {
    if (!draft || !workspace || !analysis) return;
    saveResumeWorkspace({
      resumeText: serializeResumeDraft(draft),
      jd: workspace.jd,
      occupationFamily:
        analysis.evaluation_context.occupation_family,
    });
    router.push("/");
  }

  if (!ready) {
    return <div className="h-96 animate-pulse rounded-[28px] bg-slate-200" />;
  }
  if (!workspace || !analysis) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-emerald-600">缺少当前会话材料</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          请先重新上传简历并完成招聘模拟
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          为保护隐私，旧会话不会恢复原始简历或岗位描述。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          返回首页
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-slate-950 p-7 text-white md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
          Evidence Resume Workbench
        </p>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">
          根据招聘卡点，写一份有证据的简历
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          原简历、岗位描述和草稿只保存在当前标签页。AI 不会替你编造经历，
          缺少事实时必须先回答问题。
        </p>
        <div className="mt-6 grid gap-2 text-xs sm:grid-cols-4">
          {["岗位缺口", "补充真实经历", "结构化编辑", "模板与导出"].map(
            (step, index) => (
              <div
                key={step}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
              >
                <span className="mr-2 text-emerald-300">{index + 1}</span>
                {step}
              </div>
            ),
          )}
        </div>
      </section>

      {!plan ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-950">生成定向改写规划</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            系统将结合“{analysis.bottleneck_stage || "当前招聘路径"}”和五维招聘证据，
            拆解简历结构并提出最多 5 个事实问题。
          </p>
          <button
            type="button"
            onClick={createPlan}
            disabled={Boolean(loading)}
            className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading === "plan" ? "正在分析岗位缺口…" : "开始信息核对"}
          </button>
        </section>
      ) : (
        <>
          {!rewritten ? (
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
                    Student Evidence Guide
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    补齐岗位需要的经历证据
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    我们发现了一些招聘方可能会追问的信息。请从真实的社团、
                    课程项目、竞赛、实习或志愿活动中回忆；上面的提示不会自动写入简历。
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
                  <p className="text-xs text-slate-400">完成进度</p>
                  <p className="mt-1 text-lg font-bold">
                    {completedQuestions.size}/{plan.questions.length}
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {plan.questions.length === 0 ? (
                  <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                    当前材料没有必须补充的信息，可以直接进入简历整理。
                  </p>
                ) : (
                  plan.questions.map((question) => (
                    <EvidenceQuestionCard
                      key={question.id}
                      question={question}
                      answer={answers[question.id]}
                      complete={completedQuestions.has(question.id)}
                      highlighted={highlightedQuestion === question.id}
                      onChange={updateAnswer}
                      register={(element) => {
                        questionElements.current[question.id] = element;
                      }}
                    />
                  ))
                )}
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={factsConfirmed}
                  onChange={(event) => {
                    setFactsConfirmed(event.target.checked);
                    setError("");
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold">
                    我确认以上内容来自真实经历，没有虚构或夸大。
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    选择“暂时没有”或“不确定”不会扣分，也不会被 AI 写入简历。
                  </span>
                </span>
              </label>
              {missingRequired.length > 0 ? (
                <p className="mt-4 text-sm font-medium text-amber-700">
                  还有 {missingRequired.length} 项需要补充；点击生成后会自动定位。
                </p>
              ) : null}
              <button
                type="button"
                onClick={rewriteResume}
                disabled={Boolean(loading)}
                className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {loading === "rewrite" ? "正在整理简历…" : "根据事实生成简历"}
              </button>
            </section>
          ) : draft ? (
            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 md:p-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">结构化编辑</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    AI 修改不会静默覆盖；每条经历都可以恢复为原文。
                  </p>
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  个人简介
                  <textarea
                    value={draft.basics.summary}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        basics: { ...draft.basics, summary: event.target.value },
                      })
                    }
                    className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  专业技能
                  <textarea
                    value={draft.skills.join("、")}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        skills: event.target.value
                          .split(/[、,\n]/)
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>
                {[...draft.experiences, ...draft.projects].flatMap((entry) =>
                  entry.bullets.map((bullet) => {
                    const original = findBullet(plan.draft, bullet.id);
                    const changed = original && original.text !== bullet.text;
                    return (
                      <div key={bullet.id} className="rounded-2xl border border-slate-100 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-emerald-600">
                            {changed ? "AI 改写建议" : "原始事实"}
                          </span>
                          {changed ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft(
                                  replaceBullet(draft, bullet.id, () => original),
                                )
                              }
                              className="text-xs text-slate-500 underline"
                            >
                              恢复原文
                            </button>
                          ) : null}
                        </div>
                        {changed ? (
                          <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-400 line-through">
                            {original.text}
                          </p>
                        ) : null}
                        <textarea
                          value={bullet.text}
                          onChange={(event) =>
                            setDraft(
                              replaceBullet(draft, bullet.id, (current) => ({
                                ...current,
                                text: event.target.value,
                                status: "AI_REWRITE",
                              })),
                            )
                          }
                          className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </div>
                    );
                  }),
                )}
              </div>

              <aside className="space-y-5">
                <section className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <h2 className="font-bold text-slate-950">选择简历模板</h2>
                  <div className="mt-3 grid gap-2">
                    {(Object.keys(RESUME_TEMPLATES) as TemplateId[]).map((id) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setTemplate(id)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                          template === id
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        {RESUME_TEMPLATES[id].label}
                      </button>
                    ))}
                  </div>
                </section>
                <TemplatePreview draft={draft} template={template} />
                <section className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={blocking || needsInput || Boolean(loading)}
                      onClick={() => exportResume("pdf")}
                      className="rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {loading === "pdf" ? "生成中…" : "下载 PDF"}
                    </button>
                    <button
                      type="button"
                      disabled={blocking || needsInput || Boolean(loading)}
                      onClick={() => exportResume("docx")}
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"
                    >
                      {loading === "docx" ? "生成中…" : "下载 DOCX"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={simulateAgain}
                    className="mt-3 w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white"
                  >
                    用新版简历重新模拟
                  </button>
                </section>
              </aside>
            </section>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

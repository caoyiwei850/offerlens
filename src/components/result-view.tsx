import Link from "next/link";

import { APPLICATION_STATUS_LABELS } from "@/lib/analysis/evidence";
import type {
  HiringSimulation,
  OccupationCorrection,
} from "@/lib/analysis/types";
import { Disclaimer } from "./disclaimer";
import { EvidenceAssessmentView } from "./evidence-assessment";
import { EvaluationContextView } from "./evaluation-context";
import { HiringFlow } from "./hiring-flow";
import { OccupationCorrectionControl } from "./occupation-correction-control";

export function ResultView({
  simulation,
  correction = null,
}: {
  simulation: HiringSimulation;
  correction?: OccupationCorrection | null;
}) {
  const passed = simulation.final_result === "PASS";

  return (
    <div className="space-y-6">
      {/* 深色英雄块：最终结论 + 卡点 */}
      <section className="overflow-hidden rounded-[30px] bg-slate-950 px-6 py-8 text-white shadow-2xl shadow-slate-900/15 md:px-10 md:py-10">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                passed
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "bg-red-400/10 text-red-300"
              }`}
            >
              AI 招聘流程模拟完成
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
              {passed ? "你的材料已通过筛选，" : "你被淘汰在 "}
              <br className="hidden sm:block" />
              {passed ? (
                <span className="text-emerald-400">准备迎接面试吧！</span>
              ) : (
                <span className="text-red-400">{simulation.bottleneck_stage}。</span>
              )}
            </h1>
            {passed ? (
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                五个阶段全部通过。模拟结果不代表真实招聘决定，请按下方建议继续准备，把能力变成招聘方看得懂的证据。
              </p>
            ) : (
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                {simulation.bottleneck_reason}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/resume"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-100"
              >
                根据卡点改写简历
              </Link>
              <Link
                href="/share"
                className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                生成脱敏分享卡
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl border border-emerald-300 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
              >
                注册保存本次分析
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                重新模拟
              </Link>
            </div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-400">
              投递建议
            </p>
            <p className="mt-3 text-3xl font-black text-white">
              {APPLICATION_STATUS_LABELS[simulation.application_status]}
            </p>
            <p className="mt-5 text-sm font-semibold tabular-nums text-sky-300">
              已通过 {simulation.passed_stage_count}/5 个招聘阶段
            </p>
            <p className="mt-2 text-xs text-slate-500">不代表 Offer 概率</p>
          </div>
        </div>
      </section>

      <EvaluationContextView context={simulation.evaluation_context} />
      <OccupationCorrectionControl
        context={simulation.evaluation_context}
        correction={correction}
      />

      {/* 招聘流程图（核心） */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            Hiring Flow
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">招聘流程预测</h2>
        </div>
        <HiringFlow simulation={simulation} />
      </section>

      <EvidenceAssessmentView assessment={simulation.evidence_assessment} />

      {/* 卡点分析（核心增长点）/ 全流程通过 */}
      {passed ? (
        <section className="rounded-[28px] border border-emerald-100 bg-emerald-50/50 p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-950">模拟筛选已通过</h2>
          <div className="mt-5 flex gap-3 rounded-xl bg-white p-4 text-sm text-emerald-900">
            <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="leading-6">
              五个模拟阶段没有发现明显断点。继续按下方建议打磨表达，把经历细节、专业判断和可验证结果讲清楚，面试时会更有底气。
            </span>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-red-100 bg-white p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-950">卡点分析</h2>
          <div className="mt-5 space-y-3">
            <div className="flex gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-900">
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
              <div className="leading-6">
                <p className="font-semibold">你被淘汰在：{simulation.bottleneck_stage}</p>
                <p className="mt-1 text-red-700">{simulation.bottleneck_reason}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 优化路径 */}
      <section className="rounded-[28px] border border-emerald-100 bg-emerald-50/50 p-6 md:p-8">
        <h2 className="text-xl font-bold text-slate-950">下一步该怎么改</h2>
        <ol className="mt-5 space-y-3">
          {simulation.improvements.map((suggestion, index) => (
            <li key={suggestion} className="flex gap-3 rounded-xl bg-white p-4 text-sm text-slate-700">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="leading-6">{suggestion}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Link
            href="/resume"
            className="inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-emerald-600"
          >
            根据卡点改写简历
          </Link>
        </div>
      </section>

      <div className="flex justify-center pt-2">
        <Disclaimer />
      </div>
    </div>
  );
}

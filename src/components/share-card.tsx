import { forwardRef } from "react";

import { APPLICATION_STATUS_LABELS } from "@/lib/analysis/evidence";
import type { HiringSimulation } from "@/lib/analysis/types";

export const ShareCard = forwardRef<HTMLDivElement, { simulation: HiringSimulation }>(
  function ShareCard({ simulation }, ref) {
    const passed = simulation.final_result === "PASS";

    return (
      <div
        ref={ref}
        className="relative overflow-hidden rounded-[32px] bg-slate-950 p-7 text-white shadow-2xl sm:p-10"
      >
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-sm font-black text-slate-950">
                O
              </span>
              <div>
                <p className="font-bold">OfferLens V2</p>
                <p className="text-[10px] tracking-[0.18em] text-slate-500">HIRING FLOW SIMULATOR</p>
              </div>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
              脱敏结果
            </span>
          </div>

          <div className="mt-12">
            <p
              className={`text-sm font-medium ${
                passed ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {passed ? "我的 AI 招聘流程模拟" : "我的 AI 招聘流程模拟·卡点"}
            </p>
            <p className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              {passed ? (
                "可以准备面试了"
              ) : (
                <>
                  卡在
                  <br />
                  「{simulation.bottleneck_stage}」
                </>
              )}
            </p>
            <p className="mt-5 inline-flex rounded-full bg-sky-400/10 px-3 py-1.5 text-sm font-semibold text-sky-300">
              已通过 {simulation.passed_stage_count}/5 个招聘阶段
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              投递建议：{APPLICATION_STATUS_LABELS[simulation.application_status]}
            </p>
          </div>

          {!passed ? (
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                BOTTLENECK REASON
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {simulation.bottleneck_reason}
              </p>
            </div>
          ) : null}

          {/* 流程迷你条 */}
          <div className="mt-8 flex items-center gap-1.5">
            {simulation.flow.map((step) => (
              <span
                key={step.stage}
                aria-hidden="true"
                className={`h-2 flex-1 rounded-full ${
                  step.status === "PASS"
                    ? "bg-emerald-400"
                    : step.status === "FAIL"
                      ? "bg-red-400"
                      : "bg-white/10"
                }`}
              />
            ))}
          </div>

          <div className="mt-8 flex items-end justify-between border-t border-white/10 pt-5">
            <p className="max-w-xs text-xs leading-5 text-slate-500">
              AI 模拟招聘判断，不代表真实招聘结果
            </p>
            <p className="text-right text-[10px] leading-4 text-slate-600">
              未包含姓名、简历或完整岗位描述
            </p>
          </div>
        </div>
      </div>
    );
  },
);

"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

import { ResultView } from "@/components/result-view";
import { CommentsSection } from "@/components/comments-section";
import type { HiringSimulation } from "@/lib/analysis/types";
import {
  loadAnalysisResult,
  loadOccupationCorrection,
} from "@/lib/client/result-storage";
import { trackAnalyticsOnce } from "@/lib/client/analytics";

export default function ResultPage() {
  const loaded = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const simulation: HiringSimulation | null = loaded ? loadAnalysisResult() : null;
  const correction = loaded ? loadOccupationCorrection() : null;

  useEffect(() => {
    if (!simulation) return;
    trackAnalyticsOnce("result", "RESULT_VIEWED", {
      result: simulation.final_result,
      applicationStatus: simulation.application_status,
      occupationFamily: simulation.evaluation_context.occupation_family,
    });
  }, [simulation]);

  if (!loaded) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-6xl animate-pulse px-5 py-10 md:px-8">
        <div className="h-80 rounded-[30px] bg-slate-200" />
      </main>
    );
  }

  if (!simulation) {
    return (
      <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center">
        <div>
          <p className="text-sm font-semibold text-emerald-600">还没有模拟结果</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">先完成一次招聘流程模拟</h1>
          <Link
            href="/"
            className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            返回输入页
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
      <ResultView simulation={simulation} correction={correction} />
      <aside className="mt-6 flex flex-col justify-between gap-4 rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold text-slate-900">
            等你真正参加面试后，欢迎回来
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            不用重新分析，直接反馈实际进展和判断是否吻合。
          </p>
        </div>
        <Link
          href="/feedback"
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          保存面试后反馈入口
        </Link>
      </aside>
      <div className="mt-6">
        <CommentsSection />
      </div>
    </main>
  );
}

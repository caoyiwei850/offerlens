"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { ShareCard } from "@/components/share-card";
import type { HiringSimulation } from "@/lib/analysis/types";
import { loadAnalysisResult } from "@/lib/client/result-storage";
import { buildShareText } from "@/lib/client/share-text";
import { trackAnalytics, trackAnalyticsOnce } from "@/lib/client/analytics";

function downloadDataUrl(dataUrl: string) {
  const anchor = document.createElement("a");
  anchor.download = "offerlens-result.png";
  anchor.href = dataUrl;
  anchor.click();
}

export default function SharePage() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");
  const loaded = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const simulation: HiringSimulation | null = loaded ? loadAnalysisResult() : null;

  useEffect(() => {
    if (!simulation) return;
    trackAnalyticsOnce("share", "SHARE_VIEWED", {
      result: simulation.final_result,
      applicationStatus: simulation.application_status,
      occupationFamily: simulation.evaluation_context.occupation_family,
    });
  }, [simulation]);

  async function renderCard(): Promise<string> {
    if (!cardRef.current) throw new Error("分享卡尚未准备好");
    const { toPng } = await import("html-to-image");
    return toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#020617",
    });
  }

  async function copyImage() {
    try {
      const dataUrl = await renderCard();
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setStatus("图片已复制");
        trackAnalytics("SHARE_ACTION", { action: "COPY_IMAGE" });
      } else {
        downloadDataUrl(dataUrl);
        setStatus("浏览器不支持复制图片，已改为下载");
        trackAnalytics("SHARE_ACTION", { action: "DOWNLOAD_IMAGE" });
      }
    } catch {
      setStatus("复制失败，请使用下载图片");
    }
  }

  async function downloadImage() {
    try {
      downloadDataUrl(await renderCard());
      setStatus("图片已下载");
      trackAnalytics("SHARE_ACTION", { action: "DOWNLOAD_IMAGE" });
    } catch {
      setStatus("图片生成失败，请稍后重试");
    }
  }

  async function copyText() {
    if (!simulation) return;
    try {
      await navigator.clipboard.writeText(
        buildShareText(simulation, window.location.origin),
      );
      setStatus("分享文案已复制");
      trackAnalytics("SHARE_ACTION", { action: "COPY_TEXT" });
    } catch {
      setStatus("复制失败，请手动截取卡片");
    }
  }

  if (!loaded) {
    return <main className="min-h-[65vh]" />;
  }

  if (!simulation) {
    return (
      <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">暂无可分享的模拟结果</h1>
          <Link href="/" className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            去完成模拟
          </Link>
        </div>
      </main>
    );
  }

  const passed = simulation.final_result === "PASS";

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold text-emerald-600">分享你的模拟结果</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {passed ? "一张通过模拟筛选的卡片" : "一张不泄露简历的卡点卡片"}
        </h1>
        <p className="mt-3 text-sm text-slate-500">卡片只展示卡点和流程摘要，不包含姓名、简历或完整岗位描述。</p>
      </div>

      <ShareCard ref={cardRef} simulation={simulation} />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button onClick={copyText} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-300">
          复制分享文案
        </button>
        <button onClick={copyImage} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600">
          复制图片
        </button>
        <button onClick={downloadImage} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-300">
          下载 PNG
        </button>
      </div>
      <p aria-live="polite" className="mt-4 min-h-5 text-center text-sm text-emerald-700">
        {status}
      </p>
      <div className="mt-2 text-center">
        <Link href="/result" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          返回完整报告
        </Link>
      </div>
    </main>
  );
}

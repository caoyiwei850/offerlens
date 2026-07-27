"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { loadAnalysisResult, loadOccupationCorrection } from "@/lib/client/result-storage";
import { loadResumeWorkbenchState } from "@/lib/client/resume-workbench-state";
import { loadResumeWorkspace } from "@/lib/client/resume-workspace";

const IMPORTED_KEY = "offerlens_imported_session_ids";

function importedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(IMPORTED_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function normalizeImportText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function currentImportId(): string {
    if (typeof window === "undefined") return "";
    const workspace = loadResumeWorkspace();
    const analysis = loadAnalysisResult();
    if (!workspace || !analysis) return "";
    return [
      "session",
      stableHash(normalizeImportText(workspace.resumeText)),
      stableHash(normalizeImportText(workspace.jd)),
      stableHash(workspace.occupationFamily ?? "AUTO"),
      stableHash(analysis.evaluation_context.occupation_name),
    ].join("-");
}

export function SessionImportCard({
  onImported,
}: {
  onImported?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [importId] = useState(currentImportId);
  const [available, setAvailable] = useState(
    () => Boolean(importId) && !importedIds().includes(importId),
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function importSession() {
    const workspace = loadResumeWorkspace();
    const analysis = loadAnalysisResult();
    if (!workspace || !analysis || !importId) return;
    const workbench = loadResumeWorkbenchState();
    setPending(true);
    setMessage("");
    const response = await fetch("/api/workspace/import-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientImportId: importId,
        resumeText: workspace.resumeText,
        jobDescription: workspace.jd,
        analysis,
        correction: loadOccupationCorrection(),
        workbenchState: workbench,
        plan: workbench?.plan,
        rewritten: workbench?.rewritten ?? undefined,
      }),
    });
    setPending(false);
    if (!response.ok) {
      setMessage("保存失败，请稍后重试。");
      return;
    }
    localStorage.setItem(
      IMPORTED_KEY,
      JSON.stringify([...new Set([...importedIds(), importId])]),
    );
    setAvailable(false);
    setMessage("已保存到工作台。");
    await onImported?.();
    router.refresh();
  }

  if (!available && !message) return null;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h2 className="text-lg font-black text-slate-950">保存刚才这次分析</h2>
      <p className="mt-2 text-sm leading-6 text-emerald-900">
        检测到当前标签页里有一份匿名分析。确认后才会把简历、岗位描述和简历草稿保存到你的账号。
      </p>
      {available ? (
        <button
          type="button"
          onClick={importSession}
          disabled={pending}
          className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-400"
        >
          {pending ? "保存中..." : "保存到我的工作台"}
        </button>
      ) : null}
      {message ? <p className="mt-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
    </section>
  );
}

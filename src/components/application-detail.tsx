"use client";

import { useCallback, useEffect, useState } from "react";

interface ApplicationDetails {
  id: string;
  title: string;
  analysis: { bottleneck_stage?: string; application_status?: string } | null;
  jobSnapshot: { title: string; description: string };
  resumeVersions: Array<{ id: string; title: string; createdAt: string }>;
  reviewReports: Array<{ id: string; report: { summary: string; issues: Array<{ id: string; reason: string; suggestion: string }> } }>;
  interviewPacks: Array<{ id: string; pack: { summary: string; questions: Array<{ id: string; question: string; answerStructure: string }> } }>;
}

export function ApplicationDetail({ initialId }: { initialId: string }) {
  const [application, setApplication] = useState<ApplicationDetails | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const payload = await fetch("/api/workspace/applications", {
      cache: "no-store",
    }).then((response) => response.json());
    const found = (payload.applications || []).find(
      (item: ApplicationDetails) => item.id === initialId,
    );
    setApplication(found || null);
  }, [initialId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace/applications", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const found = (payload.applications || []).find(
          (item: ApplicationDetails) => item.id === initialId,
        );
        setApplication(found || null);
      })
      .catch(() => {
        if (!cancelled) setApplication(null);
      });
    return () => {
      cancelled = true;
    };
  }, [initialId]);

  async function generate(kind: "review" | "interview-pack") {
    if (!application?.resumeVersions[0]) {
      setMessage("这个工作区还没有可评审的简历版本。");
      return;
    }
    setMessage("生成中...");
    const response = await fetch(`/api/workspace/applications/${application.id}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeVersionId: application.resumeVersions[0].id }),
    });
    setMessage(response.ok ? "已生成。" : "生成失败，请稍后重试。");
    await load();
  }

  if (!application) {
    return <p className="text-sm text-slate-500">正在载入岗位工作区...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-emerald-700">
          {application.analysis?.application_status || "已保存岗位"}
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">{application.title}</h1>
        <p className="mt-3 max-h-40 overflow-auto rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          {application.jobSnapshot.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => generate("review")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
            生成二次评审
          </button>
          <button onClick={() => generate("interview-pack")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
            生成面试包
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-950">简历版本</h2>
        <div className="mt-4 space-y-2">
          {application.resumeVersions.map((version) => (
            <p key={version.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {version.title} · {new Date(version.createdAt).toLocaleString()}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-950">二次评审</h2>
        <div className="mt-4 space-y-3">
          {application.reviewReports.map((report) => (
            <article key={report.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm leading-6 text-slate-700">{report.report.summary}</p>
              {report.report.issues.map((issue) => (
                <p key={issue.id} className="mt-2 text-sm text-slate-500">
                  {issue.reason} 建议：{issue.suggestion}
                </p>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-950">面试追问准备包</h2>
        <div className="mt-4 space-y-3">
          {application.interviewPacks.map((pack) => (
            <article key={pack.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm leading-6 text-slate-700">{pack.pack.summary}</p>
              {pack.pack.questions.map((question) => (
                <div key={question.id} className="mt-3 rounded-xl bg-emerald-50 p-3">
                  <p className="font-semibold text-slate-950">{question.question}</p>
                  <p className="mt-1 text-sm text-slate-600">{question.answerStructure}</p>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

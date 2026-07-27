"use client";

import { useEffect, useState, type FormEvent } from "react";
import { buildResumeProfileTitle } from "@/lib/workspace/resume-profile-label";

interface SavedResume {
  id: string;
  title: string;
  resumeText: string;
  updatedAt?: string;
}

export function CompareWorkbench() {
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jobs, setJobs] = useState([
    { title: "", description: "" },
    { title: "", description: "" },
  ]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace/resumes", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { resumes: [] }))
      .then((payload) => {
        if (cancelled) return;
        const resumes = (payload.resumes || []) as SavedResume[];
        setSavedResumes(resumes);
        const first = resumes[0];
        if (first?.resumeText) {
          setSelectedResumeId(first.id);
          setResumeText((current) => current || first.resumeText);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function selectSavedResume(id: string) {
    setSelectedResumeId(id);
    const resume = savedResumes.find((item) => item.id === id);
    if (resume) setResumeText(resume.resumeText);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult(null);
    const response = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText,
        jobs: jobs.map((job, index) => ({
          id: `job-${index + 1}`,
          title: job.title || undefined,
          description: job.description,
        })),
      }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(payload?.error?.message || "岗位对比失败，请重试");
      return;
    }
    setResult(payload);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-black text-slate-950">多岗位对比</h1>
        {savedResumes.length ? (
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            选择已保存简历
            <select
              value={selectedResumeId}
              onChange={(event) => selectSavedResume(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-emerald-400"
            >
              {savedResumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {buildResumeProfileTitle({
                    storedTitle: resume.title,
                    resumeText: resume.resumeText,
                    createdAt: resume.updatedAt,
                  })}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mt-5 block text-sm font-semibold text-slate-700">
          基础简历
          <textarea
            value={resumeText}
            onChange={(event) => {
              setResumeText(event.target.value);
              setSelectedResumeId("");
            }}
            className="mt-2 min-h-48 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400"
            required
          />
        </label>
      </section>
      <section className="space-y-3">
        {jobs.map((job, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-950">岗位 {index + 1}</h2>
              {jobs.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setJobs((items) => items.filter((_, i) => i !== index))}
                  className="text-sm font-semibold text-red-600"
                >
                  删除
                </button>
              ) : null}
            </div>
            <input
              value={job.title}
              onChange={(event) =>
                setJobs((items) =>
                  items.map((item, i) =>
                    i === index ? { ...item, title: event.target.value } : item,
                  ),
                )
              }
              placeholder="岗位名称（可选）"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400"
            />
            <textarea
              value={job.description}
              onChange={(event) =>
                setJobs((items) =>
                  items.map((item, i) =>
                    i === index ? { ...item, description: event.target.value } : item,
                  ),
                )
              }
              placeholder="粘贴 OCR 或复制得到的岗位描述"
              className="mt-3 min-h-40 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400"
              required
            />
          </div>
        ))}
        {jobs.length < 5 ? (
          <button
            type="button"
            onClick={() => setJobs((items) => [...items, { title: "", description: "" }])}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            添加岗位
          </button>
        ) : null}
      </section>
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-400"
      >
        {pending ? "分析中..." : "开始对比"}
      </button>
      {result ? <CompareResult payload={result} /> : null}
    </form>
  );
}

function CompareResult({ payload }: { payload: unknown }) {
  const value = payload as {
    summary?: { overallAdvice?: string };
    results?: Array<{
      jobId: string;
      title: string;
      priority: string;
      rankReason: string;
      simulation: { application_status: string; passed_stage_count: number; improvements: string[] };
    }>;
  };
  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5">
      <h2 className="text-xl font-black text-slate-950">对比结果</h2>
      <p className="mt-2 text-sm text-slate-600">{value.summary?.overallAdvice}</p>
      <div className="mt-5 space-y-3">
        {value.results?.map((item, index) => (
          <article key={item.jobId} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-emerald-700">第 {index + 1} 优先</p>
            <h3 className="mt-1 font-black text-slate-950">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{item.rankReason}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {item.simulation.application_status} · 已通过 {item.simulation.passed_stage_count}/5
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {item.simulation.improvements.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

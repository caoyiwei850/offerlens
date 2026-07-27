"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  areResumeProfilesNearDuplicate,
  buildResumeProfileTitle,
  detectResumeLocation,
} from "@/lib/workspace/resume-profile-label";

interface ResumeItem {
  id: string;
  title: string;
  resumeText: string;
  updatedAt: string;
}

export function ResumeLibrary() {
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [title, setTitle] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/workspace/resumes", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      setResumes(payload.resumes || []);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace/resumes", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { resumes: [] }))
      .then((payload) => {
        if (!cancelled) setResumes(payload.resumes || []);
      })
      .catch(() => {
        if (!cancelled) setResumes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/workspace/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, resumeText }),
    });
    if (!response.ok) {
      setMessage("保存失败，请确认已登录。");
      return;
    }
    setTitle("");
    setResumeText("");
    setMessage("已保存基础简历。");
    await load();
  }

  const resumeViews = useMemo(
    () =>
      resumes.map((resume) => {
        const similarCount = resumes.filter(
          (candidate) =>
            candidate.id !== resume.id &&
            areResumeProfilesNearDuplicate(resume.resumeText, candidate.resumeText),
        ).length;
        const displayTitle = buildResumeProfileTitle({
          storedTitle: resume.title,
          resumeText: resume.resumeText,
          createdAt: resume.updatedAt,
        });
        return {
          ...resume,
          displayTitle,
          location: detectResumeLocation(resume.resumeText),
          similarCount,
        };
      }),
    [resumes],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">求职工作台</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">基础简历</h1>
        </div>
        <Link
          href="/workspace"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          返回求职工作台
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-950">新增基础简历</h2>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="简历名称"
          className="mt-5 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400"
          required
        />
        <textarea
          value={resumeText}
          onChange={(event) => setResumeText(event.target.value)}
          placeholder="粘贴一版基础简历"
          className="mt-3 min-h-80 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400"
          required
        />
        <button className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
          保存
        </button>
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </form>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-950">已保存</h2>
        <div className="mt-4 space-y-3">
          {resumeViews.length ? (
            resumeViews.map((resume) => (
              <article key={resume.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-950">{resume.displayTitle}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resume.location ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        {resume.location}
                      </span>
                    ) : null}
                    {resume.similarCount ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        与 {resume.similarCount} 份高度相似
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  {resume.resumeText}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              当前账号还没有保存基础简历。保存一版后，下次可以直接复用它做多岗位对比和岗位定制。
            </p>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

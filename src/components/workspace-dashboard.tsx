"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { SessionImportCard } from "./session-import-card";

interface ApplicationItem {
  id: string;
  title: string;
  updatedAt: string;
  jobSnapshot: { title: string };
  resumeVersions: unknown[];
  reviewReports: unknown[];
  interviewPacks: unknown[];
}

interface ResumeItem {
  id: string;
}

function formatTestTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}/${part("month")}/${part("day")} ${part("hour")}:${part("minute")}`;
}

export function WorkspaceDashboard() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const me = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
    setUser(me.user);
    if (me.user) {
      const [applicationsPayload, resumesPayload] = await Promise.all([
        fetch("/api/workspace/applications", {
          cache: "no-store",
        }).then((r) => r.json()),
        fetch("/api/workspace/resumes", {
          cache: "no-store",
        }).then((r) => r.json()),
      ]);
      setApplications(applicationsPayload.applications || []);
      setResumes(resumesPayload.resumes || []);
    } else {
      setApplications([]);
      setResumes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">正在载入工作台...</p>;
  }

  if (!user) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-black text-slate-950">求职工作台</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          登录后可以保存简历、岗位、二次评审和面试包。匿名分析仍可继续使用。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/auth/register" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
            注册账号
          </Link>
          <Link href="/auth/login" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
            登录
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-emerald-700">{user.email}</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">求职工作台</h1>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/workspace/resumes" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
            基础简历
          </Link>
          <Link href="/compare" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
            多岗位对比
          </Link>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <Link href="/workspace/resumes" className="rounded-xl bg-slate-50 px-4 py-3 transition hover:bg-emerald-50">
            <span className="block text-xs font-bold text-slate-400">基础简历库</span>
            <span className="mt-1 block font-semibold text-slate-950">{resumes.length} 份简历</span>
          </Link>
          <a href="#application-history" className="rounded-xl bg-slate-50 px-4 py-3 transition hover:bg-emerald-50">
            <span className="block text-xs font-bold text-slate-400">以往测试记录</span>
            <span className="mt-1 block font-semibold text-slate-950">{applications.length} 个岗位工作区</span>
          </a>
        </div>
      </section>
      <SessionImportCard onImported={load} />
      <section id="application-history" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-950">以往测试记录</h2>
        <div className="mt-4 space-y-3">
          {applications.length ? (
            applications.map((item) => (
              <Link
                key={item.id}
                href={`/workspace/applications/${item.id}`}
                className="block rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{item.title || item.jobSnapshot.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      简历版本 {item.resumeVersions.length} · 评审 {item.reviewReports.length} · 面试包 {item.interviewPacks.length}
                    </p>
                  </div>
                  <time
                    dateTime={item.updatedAt}
                    className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500"
                  >
                    测试时间 {formatTestTime(item.updatedAt)}
                  </time>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              当前账号还没有保存过测试记录。匿名分析完成后点击“注册保存本次分析”，或在登录状态下保存岗位工作区后，这里会显示以往岗位、简历版本、二次评审和面试包。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

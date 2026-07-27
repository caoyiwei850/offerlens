import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "OfferLens V2｜全职业招聘流程模拟器",
  description:
    "面向技术、商业、教育、医护、制造和服务等职业，模拟材料初筛到面试决策的招聘路径。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" className="flex items-center gap-3 text-slate-950">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">
              O
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight">OfferLens V2</span>
              <span className="block text-[10px] tracking-[0.18em] text-slate-400">
                HIRING FLOW SIMULATOR
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-2.5">
            <Link
              href="/"
              title="首页"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <span aria-hidden="true" className="text-base leading-none">⌂</span>
              <span>首页</span>
            </Link>
            <Link
              href="/workspace"
              className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              工作台
            </Link>
            <Link
              href="/compare"
              className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              多岗位对比
            </Link>
            <Link
              href="/feedback"
              className="inline-flex min-h-10 items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              面试后反馈
            </Link>
            <span className="hidden min-h-10 items-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-500 sm:inline-flex">
              免费 MVP
            </span>
          </nav>
        </header>
        {children}
        <footer className="mx-auto max-w-7xl px-5 py-10 text-center text-xs text-slate-400 md:px-8">
          OfferLens V2 · AI 模拟招聘判断，不代表真实招聘结果 ·{" "}
          <Link href="/feedback" className="hover:text-emerald-600">
            面试后反馈
          </Link>
        </footer>
      </body>
    </html>
  );
}

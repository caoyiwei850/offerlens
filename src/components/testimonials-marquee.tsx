"use client";

import { useEffect, useState } from "react";

import type { CommentPage, PublicComment } from "@/lib/comments/types";

export function TestimonialsMarquee() {
  const [comments, setComments] = useState<PublicComment[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadApprovedComments() {
      try {
        const response = await fetch("/api/comments?limit=20");
        if (!response.ok) return;
        const page = (await response.json()) as CommentPage;
        if (!cancelled) setComments(page.comments);
      } catch {
        // 首页评价是增强内容，加载失败不影响核心分析流程。
      }
    }
    void loadApprovedComments();
    return () => {
      cancelled = true;
    };
  }, []);

  if (comments.length === 0) return null;

  const loop = [...comments, ...comments];

  return (
    <section className="mt-12" aria-labelledby="approved-testimonials-title">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            Approved Feedback
          </p>
          <h2
            id="approved-testimonials-title"
            className="mt-1 text-xl font-bold text-slate-950"
          >
            用户评价
          </h2>
        </div>
        <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs text-slate-500">
          审核后展示
        </span>
      </div>
      <div className="testimonial-marquee overflow-hidden py-1">
        <div className="testimonial-marquee-track flex w-max gap-4">
          {loop.map((comment, index) => (
            <article
              key={`${comment.id}-${index}`}
              aria-hidden={index >= comments.length ? "true" : undefined}
              className="w-[280px] shrink-0 rounded-2xl border border-white bg-white/80 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.07)] backdrop-blur sm:w-[340px]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">
                  {comment.nickname} · {comment.rating} 星
                </span>
                <span className="text-sm text-amber-500">
                  {"★".repeat(comment.rating)}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                {comment.content}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

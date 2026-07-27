"use client";

import { useEffect, useState, type FormEvent } from "react";

import { getDeviceIdentity } from "@/lib/client/device-identity";
import type {
  CommentPage,
  CommentStats,
  PublicComment,
} from "@/lib/comments/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const value = (await response.json()) as { error?: { message?: string } };
    return value.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function CommentsSection() {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [stats, setStats] = useState<CommentStats>({
    total: 0,
    averageRating: null,
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nickname, setNickname] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadInitialPage() {
      try {
        const response = await fetch("/api/comments?limit=20");
        if (!response.ok) throw new Error(await readError(response, "评论暂时无法加载"));
        const page = (await response.json()) as CommentPage;
        if (!cancelled) {
          setComments(page.comments);
          setStats(page.stats);
          setNextCursor(page.nextCursor);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "评论暂时无法加载");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitialPage();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(
        `/api/comments?limit=20&cursor=${encodeURIComponent(nextCursor)}`,
      );
      if (!response.ok) throw new Error(await readError(response, "更多评论加载失败"));
      const page = (await response.json()) as CommentPage;
      setComments((current) => [...current, ...page.comments]);
      setStats(page.stats);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更多评论加载失败");
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setSubmitting(true);
    try {
      const identity = await getDeviceIdentity();
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          rating,
          content,
          deviceId: identity.deviceId,
          fingerprint: identity.fingerprint,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "评论提交失败"));
      await response.json();
      setNickname("");
      setContent("");
      setRating(5);
      setStatus("评价已提交，审核通过后会公开显示");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "评论提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            Public Feedback
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">公开评论</h2>
          <p className="mt-2 text-sm text-slate-500">
            评价经审核后公开，请勿填写联系方式、简历内容或其他隐私信息。
          </p>
        </div>
        <div className="flex gap-2 text-xs font-medium text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1.5">
            {stats.total} 条公开评论
          </span>
          {stats.averageRating !== null ? (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
              平均 {stats.averageRating.toFixed(1)} 星
            </span>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={submitComment}
        className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 md:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="text-sm font-medium text-slate-700">
            昵称（可选）
            <input
              value={nickname}
              maxLength={30}
              onChange={(event) => setNickname(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="默认显示匿名用户"
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">
              结果是否有帮助
            </legend>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} 星`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  className={`grid h-10 w-10 place-items-center rounded-xl text-lg transition ${
                    value <= rating
                      ? "bg-amber-100 text-amber-500"
                      : "bg-white text-slate-300"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          评论内容
          <textarea
            value={content}
            minLength={2}
            maxLength={300}
            required
            onChange={(event) => setContent(event.target.value)}
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            placeholder="哪些判断有帮助？哪里还不够准确？"
          />
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs tabular-nums text-slate-400">{content.length}/300</span>
          <button
            type="submit"
            disabled={submitting || content.trim().length < 2}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "正在提交…" : "提交评价"}
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-4 min-h-5 text-sm text-emerald-700">
        {status}
      </p>

      <div className="mt-2 space-y-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">正在加载评论…</p>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            还没有公开评论，欢迎留下第一条意见。
          </p>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{comment.nickname}</span>
                  <span aria-label={`${comment.rating} 星`} className="text-sm text-amber-500">
                    {"★".repeat(comment.rating)}
                  </span>
                </div>
                <time className="text-xs text-slate-400" dateTime={comment.createdAt}>
                  {formatDate(comment.createdAt)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {comment.content}
              </p>
            </article>
          ))
        )}
      </div>

      {nextCursor ? (
        <div className="mt-5 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={loadMore}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-emerald-300"
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

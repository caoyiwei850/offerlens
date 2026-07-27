"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(payload?.error?.message || "账号操作失败，请重试");
      setPending(false);
      return;
    }
    router.push("/workspace");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-black text-slate-950">
        {mode === "register" ? "注册 OfferLens 账号" : "登录 OfferLens"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {mode === "register"
          ? "注册后可以把刚才的匿名分析保存到工作台。"
          : "登录后继续使用已保存的简历、岗位和面试包。"}
      </p>
      <label className="mt-6 block text-sm font-semibold text-slate-700">
        邮箱
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400"
          required
        />
      </label>
      <label className="mt-4 block text-sm font-semibold text-slate-700">
        密码
        <div className="mt-2 flex rounded-xl border border-slate-200 bg-white focus-within:border-emerald-400">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            className="min-w-0 flex-1 rounded-xl px-3 py-2 outline-none"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="px-3 text-xs font-semibold text-slate-500 hover:text-emerald-700"
          >
            {showPassword ? "隐藏" : "显示"}
          </button>
        </div>
      </label>
      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {pending ? "处理中..." : mode === "register" ? "注册并进入工作台" : "登录"}
      </button>
    </form>
  );
}


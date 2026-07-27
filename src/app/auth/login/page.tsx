import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <AuthForm mode="login" />
      <p className="mt-5 text-center text-sm text-slate-500">
        还没有账号？{" "}
        <Link href="/auth/register" className="font-semibold text-emerald-700">
          注册
        </Link>
      </p>
    </main>
  );
}


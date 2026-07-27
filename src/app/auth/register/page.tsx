import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <AuthForm mode="register" />
      <p className="mt-5 text-center text-sm text-slate-500">
        已有账号？{" "}
        <Link href="/auth/login" className="font-semibold text-emerald-700">
          登录
        </Link>
      </p>
    </main>
  );
}


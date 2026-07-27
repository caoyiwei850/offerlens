import type { Metadata } from "next";

import { FeedbackForm } from "@/components/feedback-form";

export const metadata: Metadata = {
  title: "面试后反馈｜OfferLens V2",
  description:
    "无需重新分析，随时反馈真实面试进展、模拟判断吻合度或产品建议。",
};

export default function FeedbackPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <FeedbackForm />
    </main>
  );
}

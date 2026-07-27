import { AnalyzeForm } from "@/components/analyze-form";
import { TestimonialsMarquee } from "@/components/testimonials-marquee";

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 md:px-8 md:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            10 年招聘视角 · 招聘流程模拟
          </div>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-[-0.04em] text-slate-950 sm:text-5xl md:text-6xl">
            别等拒信来了，
            <span className="block text-emerald-600">才知道卡在哪一关。</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-600 md:text-lg">
            输入简历和目标岗位描述，覆盖技术、销售、教育、医护、制造、
            服务等职业，规避AI初筛规则，看清卡点与下一步改法。
          </p>
        </div>

        <div className="mt-12">
          <AnalyzeForm />
        </div>

        <div className="mt-8 grid gap-3 text-sm text-slate-500 sm:grid-cols-3">
          {[
            ["01", "流程可视化", "材料初筛到面试决策，五阶段一目了然"],
            ["02", "五维招聘证据", "流程中断后仍完整判断后续证据"],
            ["03", "卡点定位", "看清卡在哪一关，以及为什么被淘汰"],
          ].map(([number, title, detail]) => (
            <div key={number} className="rounded-2xl border border-white bg-white/60 p-4">
              <span className="text-xs font-bold text-emerald-600">{number}</span>
              <p className="mt-2 font-semibold text-slate-800">{title}</p>
              <p className="mt-1 text-xs leading-5">{detail}</p>
            </div>
          ))}
        </div>

        <TestimonialsMarquee />
      </section>
    </main>
  );
}

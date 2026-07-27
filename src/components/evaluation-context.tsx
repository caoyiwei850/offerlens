import type { EvaluationContext } from "@/lib/analysis/types";
import { OCCUPATION_FAMILY_LABELS } from "@/lib/analysis/occupation";

const candidateLabels: Record<EvaluationContext["candidate_type"], string> = {
  INTERN: "实习生",
  FRESH_GRADUATE: "应届生",
  EXPERIENCED: "社招候选人",
};

const trackLabels: Record<EvaluationContext["job_track"], string> = {
  INTERNSHIP: "实习岗位",
  CAMPUS: "校招 / 初级岗位",
  EXPERIENCED: "社招岗位",
};

export function EvaluationContextView({
  context,
}: {
  context: EvaluationContext;
}) {
  return (
    <section className="rounded-[28px] border border-sky-100 bg-sky-50/60 p-6 md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
        Evaluation Standard
      </p>
      <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-950">本次采用的评测标准</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            {context.basis}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            候选人：{candidateLabels[context.candidate_type]}
          </span>
          <span className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">
            标准：{trackLabels[context.job_track]}
          </span>
          <span className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
            职业：{OCCUPATION_FAMILY_LABELS[context.occupation_family]} /{" "}
            {context.occupation_name}
          </span>
        </div>
      </div>
    </section>
  );
}

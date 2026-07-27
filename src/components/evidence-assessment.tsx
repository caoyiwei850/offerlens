import {
  EVIDENCE_DIMENSIONS,
  type EvidenceAssessment,
  type EvidenceDimensionKey,
  type EvidenceLevel,
} from "@/lib/analysis/evidence";

const levelConfig: Record<
  EvidenceLevel,
  { label: string; badge: string; surface: string; dot: string }
> = {
  SUFFICIENT: {
    label: "证据充足",
    badge: "bg-emerald-100 text-emerald-700",
    surface: "border-emerald-100 bg-emerald-50/40",
    dot: "bg-emerald-500",
  },
  WEAK: {
    label: "证据偏弱",
    badge: "bg-amber-100 text-amber-700",
    surface: "border-amber-100 bg-amber-50/40",
    dot: "bg-amber-500",
  },
  MISSING: {
    label: "关键证据缺失",
    badge: "bg-red-100 text-red-700",
    surface: "border-red-100 bg-red-50/40",
    dot: "bg-red-500",
  },
};

export function EvidenceAssessmentView({
  assessment,
}: {
  assessment: EvidenceAssessment;
}) {
  const entries = Object.entries(EVIDENCE_DIMENSIONS) as Array<
    [EvidenceDimensionKey, (typeof EVIDENCE_DIMENSIONS)[EvidenceDimensionKey]]
  >;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
          Evidence Assessment
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          五维招聘证据评测
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {assessment.summary}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          即使真实招聘路径已经中断，五个维度仍会依据简历与岗位描述
          完整判断，供你补齐后续材料。
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {entries.map(([key, config]) => {
          const dimension = assessment.dimensions[key];
          const level = levelConfig[dimension.level];

          return (
            <article
              key={key}
              className={`rounded-2xl border p-5 last:lg:col-span-2 ${level.surface}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${level.dot}`} />
                  <h3 className="font-semibold text-slate-900">{config.label}</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${level.badge}`}
                >
                  {level.label}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {dimension.reason}
              </p>
              <p className="mt-3 rounded-xl bg-white/90 px-3 py-2.5 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-800">建议：</span>
                {dimension.suggestion}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

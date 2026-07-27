import type { HiringSimulation } from "@/lib/analysis/types";

type Status = HiringSimulation["flow"][number]["status"];

const statusConfig: Record<
  Status,
  { label: string; nodeClass: string; lineClass: string; iconClass: string; badgeClass: string }
> = {
  PASS: {
    label: "PASS · 通过",
    nodeClass: "border-emerald-500 bg-emerald-50 text-emerald-700",
    lineClass: "bg-emerald-500",
    iconClass: "bg-emerald-500 text-white",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  FAIL: {
    label: "FAIL · 淘汰",
    nodeClass: "border-red-500 bg-red-50 text-red-700 ring-4 ring-red-100",
    lineClass: "bg-red-500",
    iconClass: "bg-red-500 text-white",
    badgeClass: "bg-red-100 text-red-700",
  },
  SKIPPED: {
    label: "SKIPPED · 未进入",
    nodeClass: "border-slate-200 bg-slate-50 text-slate-400",
    lineClass: "bg-slate-200",
    iconClass: "bg-slate-300 text-white",
    badgeClass: "bg-slate-100 text-slate-500",
  },
};

function StatusIcon({ status }: { status: Status }) {
  const cfg = statusConfig[status];
  return (
    <span
      aria-hidden="true"
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${cfg.iconClass}`}
    >
      {status === "PASS" ? "✓" : status === "FAIL" ? "✕" : "–"}
    </span>
  );
}

export function HiringFlow({ simulation }: { simulation: HiringSimulation }) {
  return (
    <div className="space-y-6">
      {/* 起点：简历提交 */}
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          ◉
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">简历提交</p>
          <p className="text-xs text-slate-400">候选人投递起点</p>
        </div>
      </div>

      {/* 横向 stepper（桌面）/ 纵向（移动） */}
      <ol className="grid gap-4 md:grid-cols-5 md:gap-3">
        {simulation.flow.map((step, index) => {
          const cfg = statusConfig[step.status];
          return (
            <li key={step.stage} className="relative">
              {/* 桌面：横向连接线（除最后一个） */}
              {index < simulation.flow.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-4 hidden h-0.5 w-full md:block ${cfg.lineClass}`}
                />
              ) : null}

              <div className="relative flex h-full flex-col gap-3 md:items-center md:text-center">
                <StatusIcon status={step.status} />
                <div className="md:mt-2">
                  <p className="text-sm font-semibold text-slate-900">{step.stage}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badgeClass}`}
                  >
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs leading-5 text-slate-500 md:px-1">{step.reason}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

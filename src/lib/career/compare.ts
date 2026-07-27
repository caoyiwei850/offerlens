import type { ModelCall } from "@/lib/analysis/simulate-hiring-flow";
import { simulateHiringFlow } from "@/lib/analysis/simulate-hiring-flow";
import type { HiringSimulation } from "@/lib/analysis/types";
import type {
  ComparePriority,
  CompareRequest,
  CompareResponse,
} from "./types";

function priorityFor(simulation: HiringSimulation): ComparePriority {
  if (simulation.application_status === "READY") return "PRIORITY_APPLY";
  if (simulation.application_status === "REVISE_AND_APPLY") return "REVISE_FIRST";
  if (simulation.application_status === "STRETCH") return "CAUTIOUS_TRY";
  return "HOLD";
}

const priorityWeight: Record<ComparePriority, number> = {
  PRIORITY_APPLY: 4,
  REVISE_FIRST: 3,
  CAUTIOUS_TRY: 2,
  HOLD: 1,
};

function evidenceWeight(simulation: HiringSimulation): number {
  return Object.values(simulation.evidence_assessment.dimensions).reduce(
    (total, dimension) =>
      total + (dimension.level === "SUFFICIENT" ? 2 : dimension.level === "WEAK" ? 1 : 0),
    0,
  );
}

function compareScore(simulation: HiringSimulation): number {
  return (
    priorityWeight[priorityFor(simulation)] * 100 +
    simulation.passed_stage_count * 10 +
    evidenceWeight(simulation)
  );
}

function reasonFor(simulation: HiringSimulation): string {
  if (simulation.final_result === "PASS") {
    return `模拟已通过 ${simulation.passed_stage_count}/5 个阶段，优先准备投递和面试表达。`;
  }
  return `当前卡在${simulation.bottleneck_stage}：${simulation.bottleneck_reason}`;
}

export async function compareJobs(
  input: CompareRequest,
  callModel: ModelCall,
): Promise<CompareResponse> {
  const results = await Promise.all(
    input.jobs.map(async (job, index) => {
      const simulation = await simulateHiringFlow(
        {
          resume: input.resumeText,
          jd: job.description,
        },
        callModel,
      );
      return {
        jobId: job.id || `job-${index + 1}`,
        title:
          job.title ||
          simulation.evaluation_context.occupation_name ||
          `岗位 ${index + 1}`,
        simulation,
        priority: priorityFor(simulation),
        rankReason: reasonFor(simulation),
      };
    }),
  );

  const ordered = [...results].sort((a, b) => {
    const score = compareScore(b.simulation) - compareScore(a.simulation);
    return score || a.title.localeCompare(b.title, "zh-CN");
  });

  return {
    results: ordered,
    summary: {
      bestJobId: ordered[0].jobId,
      orderedJobIds: ordered.map((result) => result.jobId),
      overallAdvice: `优先处理“${ordered[0].title}”。排序依据是投递建议、已通过招聘阶段数和五维证据完整度，不代表 Offer 概率。`,
    },
  };
}


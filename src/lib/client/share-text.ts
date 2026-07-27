import { APPLICATION_STATUS_LABELS } from "@/lib/analysis/evidence";
import type { HiringSimulation } from "@/lib/analysis/types";

export function buildShareText(
  simulation: HiringSimulation,
  shareUrl: string,
): string {
  const callToAction = `👉 测试你的卡点：${shareUrl}`;

  if (simulation.final_result === "PASS") {
    return [
      "我用 AI 模拟了招聘流程：",
      "模拟筛选已通过，可以准备面试了。",
      `已通过 ${simulation.passed_stage_count}/5 个招聘阶段`,
      `投递建议：${APPLICATION_STATUS_LABELS[simulation.application_status]}`,
      "",
      "AI 模拟招聘判断，不代表真实招聘结果。",
      callToAction,
    ].join("\n");
  }

  return [
    "我用 AI 模拟了招聘流程：",
    `我卡在「${simulation.bottleneck_stage}」`,
    `原因：${simulation.bottleneck_reason}`,
    `已通过 ${simulation.passed_stage_count}/5 个招聘阶段`,
    `投递建议：${APPLICATION_STATUS_LABELS[simulation.application_status]}`,
    "",
    "AI 模拟招聘判断，不代表真实招聘结果。",
    callToAction,
  ].join("\n");
}

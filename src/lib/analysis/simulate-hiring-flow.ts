import { deriveApplicationOutcome } from "./evidence";
import {
  hiringSimulationSchema,
  modelHiringSimulationSchema,
  type AnalysisInput,
  type HiringSimulation,
} from "./types";

export type ModelCall = (input: AnalysisInput) => Promise<string>;

export async function simulateHiringFlow(
  input: AnalysisInput,
  callModel: ModelCall,
): Promise<HiringSimulation> {
  const raw = await callModel(input);
  const parsed: unknown = JSON.parse(raw);
  const modelSimulation = modelHiringSimulationSchema.parse(parsed);
  if (
    input.occupationOverride &&
    modelSimulation.evaluation_context.occupation_family !==
      input.occupationOverride
  ) {
    throw new Error("模型返回的职业领域与用户选择不一致");
  }
  return hiringSimulationSchema.parse({
    ...modelSimulation,
    evaluation_context: {
      ...modelSimulation.evaluation_context,
      occupation_source: input.occupationOverride ? "USER_OVERRIDE" : "AUTO",
    },
    ...deriveApplicationOutcome(
      modelSimulation.flow,
      modelSimulation.evidence_assessment,
    ),
  });
}

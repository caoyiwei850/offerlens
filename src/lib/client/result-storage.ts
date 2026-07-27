import {
  hiringSimulationSchema,
  occupationCorrectionSchema,
  type HiringSimulation,
  type OccupationCorrection,
} from "@/lib/analysis/types";
import type { OccupationFamily } from "@/lib/analysis/occupation";

const RESULT_KEY = "offerlens_hiring_simulation_v6";
const CORRECTION_KEY = "offerlens_occupation_correction_v1";
const SNAPSHOT_KEY = "offerlens_analysis_snapshot_v1";

interface AnalysisSnapshotInput {
  resumeText: string;
  jd: string;
  occupationFamily: "AUTO" | OccupationFamily;
}

interface AnalysisSnapshot extends AnalysisSnapshotInput {
  analysis: HiringSimulation;
  correction: OccupationCorrection | null;
}

function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sameSnapshotInput(
  left: AnalysisSnapshotInput,
  right: AnalysisSnapshotInput,
): boolean {
  return (
    normalizeComparableText(left.resumeText) ===
      normalizeComparableText(right.resumeText) &&
    normalizeComparableText(left.jd) === normalizeComparableText(right.jd) &&
    left.occupationFamily === right.occupationFamily
  );
}

export function saveAnalysisResult(analysis: HiringSimulation): void {
  sessionStorage.setItem(RESULT_KEY, JSON.stringify(analysis));
}

export function saveOccupationCorrection(
  correction: OccupationCorrection | null,
): void {
  if (correction) {
    sessionStorage.setItem(CORRECTION_KEY, JSON.stringify(correction));
  } else {
    sessionStorage.removeItem(CORRECTION_KEY);
  }
}

export function loadOccupationCorrection(): OccupationCorrection | null {
  const value = sessionStorage.getItem(CORRECTION_KEY);
  if (!value) return null;
  try {
    const correction = occupationCorrectionSchema.parse(JSON.parse(value));
    if (Date.parse(correction.expires_at) <= Date.now()) {
      sessionStorage.removeItem(CORRECTION_KEY);
      return null;
    }
    return correction;
  } catch {
    sessionStorage.removeItem(CORRECTION_KEY);
    return null;
  }
}

export function loadAnalysisResult(): HiringSimulation | null {
  const value = sessionStorage.getItem(RESULT_KEY);
  if (!value) return null;

  try {
    return hiringSimulationSchema.parse(JSON.parse(value));
  } catch {
    sessionStorage.removeItem(RESULT_KEY);
    return null;
  }
}

export function saveAnalysisSnapshot(snapshot: AnalysisSnapshot): void {
  saveAnalysisResult(snapshot.analysis);
  saveOccupationCorrection(snapshot.correction);
  sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function loadReusableAnalysisSnapshot(
  input: AnalysisSnapshotInput,
): Pick<AnalysisSnapshot, "analysis" | "correction"> | null {
  const value = sessionStorage.getItem(SNAPSHOT_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as AnalysisSnapshot;
    const snapshot = {
      ...parsed,
      analysis: hiringSimulationSchema.parse(parsed.analysis),
      correction: parsed.correction
        ? occupationCorrectionSchema.parse(parsed.correction)
        : null,
    };
    if (!sameSnapshotInput(snapshot, input)) return null;
    return {
      analysis: snapshot.analysis,
      correction: snapshot.correction,
    };
  } catch {
    sessionStorage.removeItem(SNAPSHOT_KEY);
    return null;
  }
}

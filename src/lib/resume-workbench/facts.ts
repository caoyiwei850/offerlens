import type {
  EvidenceAnswer,
  Fact,
  ResumeBullet,
  ResumeDraft,
} from "./types";

export function buildSourceFacts(resumeText: string): Fact[] {
  return resumeText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[●•·*-]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 120)
    .map((text, index) => ({
      id: `source-${String(index + 1).padStart(3, "0")}`,
      text,
      source: "RESUME" as const,
    }));
}

export function appendEvidenceAnswerFacts(
  facts: Fact[],
  answers: EvidenceAnswer[],
): Fact[] {
  return [
    ...facts,
    ...answers.flatMap((answer) => {
      if (answer.status !== "HAS_EVIDENCE") return [];
      const text = answer.detail?.trim();
      if (!text) return [];
      return [
        {
          id: `answer-${answer.questionId}`,
          text,
          source: "ANSWER" as const,
        },
      ];
    }),
  ];
}

export function collectDraftBullets(draft: ResumeDraft): ResumeBullet[] {
  return [
    ...draft.experiences.flatMap((entry) => entry.bullets),
    ...draft.projects.flatMap((entry) => entry.bullets),
  ];
}

export function validateBulletFactReferences(
  bullets: ResumeBullet[],
  facts: Fact[],
): void {
  const factIds = new Set(facts.map((fact) => fact.id));
  for (const bullet of bullets) {
    if (bullet.factRefs.length === 0) {
      throw new Error(`FACT_REF_MISSING:${bullet.id}`);
    }
    if (bullet.factRefs.some((factId) => !factIds.has(factId))) {
      throw new Error(`FACT_REF_UNKNOWN:${bullet.id}`);
    }
  }
}

export function validateDraftFacts(draft: ResumeDraft, facts: Fact[]): void {
  validateBulletFactReferences(collectDraftBullets(draft), facts);
}

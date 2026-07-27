import { describe, expect, it } from "vitest";

import { normalizeResumeModelOutput } from "./normalize-model-output";

describe("normalizeResumeModelOutput", () => {
  it.each([
    ["自由职业", "FREELANCE"],
    ["SELF_EMPLOYED", "SELF_EMPLOYED"],
    ["志愿服务", "VOLUNTEER"],
    ["临床见习", "PRACTICUM"],
    ["未知职业经历", "OTHER"],
  ])("normalizes %s to %s", (source, expected) => {
    const normalized = normalizeResumeModelOutput({
      draft: { experiences: [{ type: source }] },
    }) as { draft: { experiences: Array<{ type: string }> } };

    expect(normalized.draft.experiences[0].type).toBe(expected);
  });

  it("does not mutate the original model payload", () => {
    const original = { draft: { experiences: [{ type: "自由职业" }] } };
    normalizeResumeModelOutput(original);
    expect(original.draft.experiences[0].type).toBe("自由职业");
  });
});

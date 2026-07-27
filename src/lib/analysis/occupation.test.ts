import { describe, expect, it } from "vitest";

import {
  OCCUPATION_FAMILIES,
  OCCUPATION_FAMILY_LABELS,
  occupationFamilySchema,
} from "./occupation";

describe("occupation families", () => {
  it("covers the agreed all-career families with user-facing labels", () => {
    expect(OCCUPATION_FAMILIES).toHaveLength(11);
    expect(OCCUPATION_FAMILY_LABELS.HEALTHCARE_CARE).toBe("医疗健康与照护");
    expect(OCCUPATION_FAMILY_LABELS.ENGINEERING_INDUSTRIAL).toBe(
      "工程制造与技术工种",
    );
    expect(OCCUPATION_FAMILY_LABELS.SERVICE_RETAIL).toBe(
      "餐饮酒店零售与生活服务",
    );
  });

  it("rejects unknown occupation families", () => {
    expect(occupationFamilySchema.safeParse("ALIEN").success).toBe(false);
  });
});

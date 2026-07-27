import { describe, expect, it } from "vitest";

import {
  loadReusableAnalysisSnapshot,
  saveAnalysisSnapshot,
} from "./result-storage";
import { analysisFixture } from "@/test/resume-fixtures";

describe("analysis snapshot storage", () => {
  it("reuses the previous analysis for the same resume, job, and occupation selection", () => {
    saveAnalysisSnapshot({
      resumeText: "张三\n负责用户增长项目策略执行。",
      jd: "岗位描述要求市场运营和用户增长。",
      occupationFamily: "AUTO",
      analysis: analysisFixture,
      correction: null,
    });

    const cached = loadReusableAnalysisSnapshot({
      resumeText: " 张三 \n\n 负责用户增长项目策略执行。 ",
      jd: "岗位描述要求市场运营和用户增长。",
      occupationFamily: "AUTO",
    });

    expect(cached?.analysis.final_result).toBe(analysisFixture.final_result);
  });

  it("does not reuse a previous analysis when the job text changes", () => {
    saveAnalysisSnapshot({
      resumeText: "张三\n负责用户增长项目策略执行。",
      jd: "岗位描述要求市场运营和用户增长。",
      occupationFamily: "AUTO",
      analysis: analysisFixture,
      correction: null,
    });

    expect(
      loadReusableAnalysisSnapshot({
        resumeText: "张三\n负责用户增长项目策略执行。",
        jd: "岗位描述要求品牌策略。",
        occupationFamily: "AUTO",
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { detectDeterministicIssues } from "./consistency";

describe("resume consistency checks", () => {
  it("flags the contradictory graduate resume as blocking", () => {
    const issues = detectDeterministicIssues(
      `张三 23岁 大学本科
大学刚毕业
深圳市蓝海优品科技有限公司 电商运营主管 2021.04 — 至今
武汉市锦程电子商务有限公司 电商运营专员 2019.08 — 2021.03`,
      [],
    );

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "WORK_STARTED_TOO_YOUNG",
        "GRADUATE_FULL_TIME_CONFLICT",
        "EDUCATION_DATES_MISSING",
      ]),
    );
    expect(issues.every((issue) => issue.severity === "BLOCKING")).toBe(true);
  });

  it("does not treat a labeled campus internship as full-time conflict", () => {
    const issues = detectDeterministicIssues(
      `2026届计算机本科
2022.09 — 2026.06 武汉大学
2025.07 — 2025.09 暑期实习 Java开发实习生`,
      [],
    );

    expect(issues).toEqual([]);
  });
});

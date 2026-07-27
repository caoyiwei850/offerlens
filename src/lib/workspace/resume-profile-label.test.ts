// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  areResumeProfilesNearDuplicate,
  buildResumeProfileTitle,
  detectResumeLocation,
} from "./resume-profile-label";

describe("resume profile labels", () => {
  it("builds a readable title for imported generic resumes", () => {
    const title = buildResumeProfileTitle({
      storedTitle: "导入的基础简历",
      resumeText: "曹一伟\n现居：武汉\n求职意向：电商运营",
      occupationName: "电商运营",
    });

    expect(title).toBe("曹一伟 · 电商运营 · 武汉");
  });

  it("detects the target role when the resume uses a heading line", () => {
    const title = buildResumeProfileTitle({
      storedTitle: "导入的基础简历",
      resumeText: "曹一伟\n求职意向\n电商运营 | 工作地点：潜江",
    });

    expect(title).toBe("曹一伟 · 电商运营 · 潜江");
  });

  it("keeps a user-provided specific title", () => {
    expect(
      buildResumeProfileTitle({
        storedTitle: "电商运营武汉投递版",
        resumeText: "曹一伟\n现居：武汉",
      }),
    ).toBe("电商运营武汉投递版");
  });

  it("detects near duplicate resumes when only the city changes", () => {
    const wuhanResume = "曹一伟\n现居：武汉\n负责电商运营、推广投放和数据复盘。";
    const qianjiangResume = "曹一伟\n现居：潜江\n负责电商运营、推广投放和数据复盘。";

    expect(detectResumeLocation(wuhanResume)).toBe("武汉");
    expect(areResumeProfilesNearDuplicate(wuhanResume, qianjiangResume)).toBe(true);
  });
});

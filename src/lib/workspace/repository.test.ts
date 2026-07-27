// @vitest-environment node

import { describe, expect, it } from "vitest";

import { analysisFixture, resumePlanFixture } from "@/test/resume-fixtures";
import { createWorkspaceRepository } from "./repository";

describe("workspace repository", () => {
  it("imports an anonymous session once and binds it to the user", () => {
    const repository = createWorkspaceRepository({
      path: ":memory:",
      createId: (() => {
        let count = 0;
        return () => `id-${++count}`;
      })(),
      now: () => "2026-07-09T00:00:00.000Z",
    });

    const first = repository.importSession("user-1", {
      clientImportId: "import-123",
      resumeText: "张三负责用户增长项目策略执行。",
      jobDescription: "岗位描述要求市场运营和用户增长。",
      analysis: analysisFixture,
      plan: resumePlanFixture,
    });
    const second = repository.importSession("user-1", {
      clientImportId: "import-123",
      resumeText: "张三负责用户增长项目策略执行。",
      jobDescription: "岗位描述要求市场运营和用户增长。",
      analysis: analysisFixture,
      plan: resumePlanFixture,
    });

    expect(second.id).toBe(first.id);
    expect(repository.listApplications("user-1")).toHaveLength(1);
    expect(repository.listApplications("user-2")).toHaveLength(0);
    expect(first.resumeVersions).toHaveLength(1);
    expect(first.jobSnapshot.description).toContain("岗位描述要求");
    repository.close();
  });

  it("creates a reviewable resume version even when the user has not generated a rewrite plan", () => {
    const repository = createWorkspaceRepository({
      path: ":memory:",
      createId: (() => {
        let count = 0;
        return () => `id-${++count}`;
      })(),
      now: () => "2026-07-09T00:00:00.000Z",
    });

    const application = repository.importSession("user-1", {
      clientImportId: "import-without-plan",
      resumeText: "张三\n负责用户增长项目策略执行。",
      jobDescription: "岗位描述要求市场运营和用户增长。",
      analysis: analysisFixture,
    });

    expect(application.resumeVersions).toHaveLength(1);
    expect(application.resumeVersions[0].title).toBe("原始简历快照");
    expect(application.resumeVersions[0].facts).toHaveLength(2);
    expect(application.resumeVersions[0].draft).toMatchObject({
      basics: {
        name: "张三",
        targetRole: analysisFixture.evaluation_context.occupation_name,
      },
    });
    repository.close();
  });

  it("reuses the same resume profile when the imported resume text is unchanged", () => {
    const repository = createWorkspaceRepository({
      path: ":memory:",
      createId: (() => {
        let count = 0;
        return () => `id-${++count}`;
      })(),
      now: () => "2026-07-09T00:00:00.000Z",
    });

    const first = repository.importSession("user-1", {
      clientImportId: "import-a",
      resumeText: "张三\n负责用户增长项目策略执行。",
      jobDescription: "岗位描述要求市场运营和用户增长。",
      analysis: analysisFixture,
    });
    const second = repository.importSession("user-1", {
      clientImportId: "import-b",
      resumeText: " 张三 \n\n 负责用户增长项目策略执行。 ",
      jobDescription: "另一个岗位描述。",
      analysis: analysisFixture,
    });

    expect(second.resumeProfileId).toBe(first.resumeProfileId);
    expect(repository.listResumeProfiles("user-1")).toHaveLength(1);
    expect(repository.listApplications("user-1")).toHaveLength(2);
    repository.close();
  });

  it("gives imported resume profiles a distinguishable default title", () => {
    const repository = createWorkspaceRepository({
      path: ":memory:",
      createId: (() => {
        let count = 0;
        return () => `id-${++count}`;
      })(),
      now: () => "2026-07-09T00:00:00.000Z",
    });

    repository.importSession("user-1", {
      clientImportId: "import-labelled",
      resumeText: "曹一伟\n现居：武汉\n负责电商运营、推广投放和数据复盘。",
      jobDescription: "岗位描述要求电商运营。",
      analysis: analysisFixture,
    });

    expect(repository.listResumeProfiles("user-1")[0].title).toBe(
      `曹一伟 · ${analysisFixture.evaluation_context.occupation_name} · 武汉`,
    );
    repository.close();
  });
});

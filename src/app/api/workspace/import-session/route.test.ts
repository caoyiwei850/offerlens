// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createImportSessionHandler } from "@/lib/workspace/api";
import { createWorkspaceRepository } from "@/lib/workspace/repository";
import { analysisFixture } from "@/test/resume-fixtures";

describe("/api/workspace/import-session", () => {
  it("requires a logged-in user before saving sensitive session data", async () => {
    const repository = createWorkspaceRepository({ path: ":memory:" });
    const handler = createImportSessionHandler({
      repository,
      getUser: () => null,
    });

    const response = await handler(
      new Request("http://localhost/api/workspace/import-session", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    expect(repository.listApplications("user-1")).toHaveLength(0);
    repository.close();
  });

  it("imports a valid current browser session for the authenticated user", async () => {
    const repository = createWorkspaceRepository({ path: ":memory:" });
    const handler = createImportSessionHandler({
      repository,
      getUser: () => ({ id: "user-1", email: "user@example.com" }),
    });

    const response = await handler(
      new Request("http://localhost/api/workspace/import-session", {
        method: "POST",
        body: JSON.stringify({
          clientImportId: "import-valid-1",
          resumeText: "张三负责用户增长项目策略执行。",
          jobDescription: "岗位描述要求市场运营和用户增长。",
          analysis: analysisFixture,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(repository.listApplications("user-1")).toHaveLength(1);
    repository.close();
  });
});

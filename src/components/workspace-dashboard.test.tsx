import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceDashboard } from "./workspace-dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("WorkspaceDashboard", () => {
  it("shows the test time on each application history card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/me") {
          return Response.json({ user: { email: "18260273@qq.com" } });
        }
        if (url === "/api/workspace/applications") {
          return Response.json({
            applications: [
              {
                id: "application-1",
                title: "电商运营",
                updatedAt: "2026-07-09T09:30:00.000Z",
                jobSnapshot: { title: "电商运营" },
                resumeVersions: [{}],
                reviewReports: [],
                interviewPacks: [],
              },
            ],
          });
        }
        return Response.json({ resumes: [] });
      }),
    );

    render(<WorkspaceDashboard />);

    expect(await screen.findByText("电商运营")).toBeInTheDocument();
    const time = screen.getByText("测试时间 2026/7/9 17:30");
    expect(time).toHaveAttribute("datetime", "2026-07-09T09:30:00.000Z");
  });
});

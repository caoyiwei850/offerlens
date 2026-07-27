import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResumeLibrary } from "./resume-library";

describe("ResumeLibrary", () => {
  it("shows distinguishable labels and near-duplicate hints for imported resumes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          resumes: [
            {
              id: "resume-1",
              title: "导入的基础简历",
              resumeText: "曹一伟\n现居：武汉\n负责电商运营、推广投放和数据复盘。",
              updatedAt: "2026-07-09T00:00:00.000Z",
            },
            {
              id: "resume-2",
              title: "导入的基础简历",
              resumeText: "曹一伟\n现居：潜江\n负责电商运营、推广投放和数据复盘。",
              updatedAt: "2026-07-09T00:00:00.000Z",
            },
          ],
        }),
      ),
    );

    render(<ResumeLibrary />);

    expect(await screen.findByText("曹一伟 · 武汉")).toBeInTheDocument();
    expect(screen.getByText("曹一伟 · 潜江")).toBeInTheDocument();
    expect(screen.getAllByText("与 1 份高度相似")).toHaveLength(2);
  });
});

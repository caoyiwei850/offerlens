import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompareWorkbench } from "./compare-workbench";

describe("CompareWorkbench", () => {
  it("loads the latest saved resume into the compare form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          resumes: [
            {
              id: "resume-1",
              title: "基础简历",
              resumeText: "张三负责用户增长项目策略执行。",
            },
          ],
        }),
      ),
    );

    render(<CompareWorkbench />);

    await waitFor(() => {
      expect(screen.getByLabelText("基础简历")).toHaveValue(
        "张三负责用户增长项目策略执行。",
      );
    });
  });

  it("lets a signed-in user choose one of their saved resumes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          resumes: [
            {
              id: "resume-1",
              title: "武汉电商运营版",
              resumeText: "武汉版基础简历",
            },
            {
              id: "resume-2",
              title: "潜江电商运营版",
              resumeText: "潜江版基础简历",
            },
          ],
        }),
      ),
    );

    render(<CompareWorkbench />);

    const selector = await screen.findByLabelText("选择已保存简历");
    fireEvent.change(selector, { target: { value: "resume-2" } });

    expect(screen.getByLabelText("基础简历")).toHaveValue("潜江版基础简历");
  });
});

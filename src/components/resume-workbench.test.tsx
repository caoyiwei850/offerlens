import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResumeWorkbench } from "./resume-workbench";
import { saveAnalysisResult } from "@/lib/client/result-storage";
import { saveResumeWorkspace } from "@/lib/client/resume-workspace";
import {
  analysisFixture,
  resumeDraft,
  resumePlanFixture,
} from "@/test/resume-fixtures";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/client/device-identity", () => ({
  getDeviceIdentity: vi.fn(async () => ({
    deviceId: "a".repeat(64),
    fingerprint: "b".repeat(64),
  })),
}));

beforeEach(() => {
  sessionStorage.clear();
  push.mockClear();
  saveAnalysisResult(analysisFixture);
  saveResumeWorkspace({
    resumeText: "张三\n负责交易系统限流改造",
    jd: "市场运营专员",
  });
});

describe("ResumeWorkbench", () => {
  it("guides a student to provide real evidence before rewriting", async () => {
    const rewritten = {
      draft: {
        ...resumeDraft,
        experiences: [
          {
            ...resumeDraft.experiences[0],
            bullets: [
              {
                ...resumeDraft.experiences[0].bullets[0],
                text: "主导交易系统限流改造，提升高峰期稳定性。",
                factRefs: ["source-002", "answer-question-1"],
                status: "AI_REWRITE",
              },
            ],
          },
        ],
      },
      facts: [
        ...resumePlanFixture.facts,
        {
          id: "answer-question-1",
          text: "高峰期稳定性提升。",
          source: "ANSWER",
        },
      ],
      changeSummary: ["强化动作与结果表达。"],
      unresolvedIssues: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(resumePlanFixture))
      .mockResolvedValueOnce(Response.json(rewritten));
    vi.stubGlobal("fetch", fetchMock);

    render(<ResumeWorkbench />);
    fireEvent.click(await screen.findByRole("button", { name: "开始信息核对" }));

    expect(
      await screen.findByRole("heading", {
        name: "补齐岗位需要的经历证据",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("能够说明项目结果")).toBeInTheDocument();
    expect(screen.getByText("更多提示")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "根据事实生成简历" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "根据事实生成简历" }));
    expect(screen.getByText("还有 1 项需要补充")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "我有类似经历" }));
    fireEvent.change(
      screen.getByLabelText("请描述这段经历的背景、你的角色、具体行动和结果"),
      {
        target: {
          value:
            "交易系统限流改造，我负责梳理核心链路并完善降级策略，高峰期稳定性提升。",
        },
      },
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /我确认以上内容来自真实经历/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "根据事实生成简历" }));

    expect(await screen.findByText("结构化编辑")).toBeInTheDocument();
    expect(screen.getByDisplayValue("主导交易系统限流改造，提升高峰期稳定性。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "专业能力版" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "职业经历版" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "校园应届版" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const rewriteRequest = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    );
    expect(rewriteRequest).toMatchObject({
      factsConfirmed: true,
      answers: [
        {
          questionId: "question-1",
          status: "HAS_EVIDENCE",
          detail:
            "交易系统限流改造，我负责梳理核心链路并完善降级策略，高峰期稳定性提升。",
        },
      ],
    });
  });
});

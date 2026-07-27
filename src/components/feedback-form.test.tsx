import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackForm } from "./feedback-form";

vi.mock("@/lib/client/device-identity", () => ({
  getDeviceIdentity: vi.fn(async () => ({
    deviceId: "a".repeat(64),
    fingerprint: "b".repeat(64),
  })),
}));

describe("FeedbackForm", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("collects interview evidence without requiring an analysis result", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { id: "feedback-1", status: "RECEIVED" },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    render(<FeedbackForm />);

    expect(
      screen.getByRole("heading", { name: "面试结束了？回来告诉我们真实结果" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "已获得 Offer" }));
    fireEvent.click(screen.getByRole("button", { name: "基本吻合" }));
    fireEvent.change(screen.getByLabelText("职业领域（可选）"), {
      target: { value: "BUSINESS_COMMERCIAL" },
    });
    fireEvent.change(screen.getByLabelText("反馈内容"), {
      target: { value: "实际面试重点与模拟卡点基本一致。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    expect(
      await screen.findByText("反馈已收到，谢谢你回来告诉我们真实结果。"),
    ).toBeInTheDocument();
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({
      kind: "INTERVIEW_OUTCOME",
      outcome: "OFFERED",
      predictionMatch: "MATCHED",
      occupationFamily: "BUSINESS_COMMERCIAL",
    });
    expect(request).not.toHaveProperty("analysis");
  });

  it("allows product suggestions without asking for interview accuracy", () => {
    render(<FeedbackForm />);
    fireEvent.click(screen.getByRole("button", { name: "我想提产品建议" }));

    expect(screen.queryByText("模拟判断和实际面试吻合吗？")).not.toBeInTheDocument();
    expect(screen.getByLabelText("反馈内容")).toHaveAttribute(
      "placeholder",
      "你希望 OfferLens 哪里做得更清楚、更省事？",
    );
  });
});

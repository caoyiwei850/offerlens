import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentsSection } from "./comments-section";
import { getDeviceIdentity } from "@/lib/client/device-identity";

vi.mock("@/lib/client/device-identity", () => ({
  getDeviceIdentity: vi.fn(async () => ({
    deviceId: "a".repeat(64),
    fingerprint: "b".repeat(64),
  })),
}));

const emptyPage = {
  comments: [],
  nextCursor: null,
  stats: { total: 0, averageRating: null },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CommentsSection", () => {
  it("loads public comments and aggregate feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          comments: [
            {
              id: "comment-1",
              nickname: "小林",
              rating: 5,
              content: "五维评测很具体。",
              createdAt: "2026-07-01T10:00:00.000Z",
            },
          ],
          nextCursor: null,
          stats: { total: 1, averageRating: 5 },
        }),
      ),
    );

    render(<CommentsSection />);

    expect(await screen.findByText("五维评测很具体。")).toBeInTheDocument();
    expect(screen.getByText("1 条公开评论")).toBeInTheDocument();
    expect(screen.getByText("平均 5.0 星")).toBeInTheDocument();
  });

  it("submits a comment for review without adding it to the public list", async () => {
    const submission = {
      id: "comment-2",
      status: "PENDING",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(emptyPage))
      .mockResolvedValueOnce(Response.json(submission, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CommentsSection />);
    await screen.findByText("还没有公开评论，欢迎留下第一条意见。");

    fireEvent.click(screen.getByRole("button", { name: "4 星" }));
    fireEvent.change(screen.getByLabelText("评论内容"), {
      target: { value: "希望增加更多岗位案例。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交评价" }));

    expect(
      await screen.findByText("评价已提交，审核通过后会公开显示"),
    ).toBeInTheDocument();
    expect(screen.queryByText("希望增加更多岗位案例。")).not.toBeInTheDocument();
    expect(getDeviceIdentity).toHaveBeenCalledOnce();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      nickname: "",
      rating: 4,
      content: "希望增加更多岗位案例。",
      deviceId: "a".repeat(64),
      fingerprint: "b".repeat(64),
    });
  });
});

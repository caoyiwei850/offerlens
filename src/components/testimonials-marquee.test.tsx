import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TestimonialsMarquee } from "./testimonials-marquee";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TestimonialsMarquee", () => {
  it("shows only comments returned by the approved public feed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          comments: [
            {
              id: "approved-1",
              nickname: "小林",
              rating: 5,
              content: "卡点定位很具体。",
              createdAt: "2026-07-02T00:00:00.000Z",
            },
          ],
          nextCursor: null,
          stats: { total: 1, averageRating: 5 },
        }),
      ),
    );

    render(<TestimonialsMarquee />);

    expect(await screen.findAllByText("卡点定位很具体。")).toHaveLength(2);
    expect(screen.getAllByText("小林 · 5 星")).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith("/api/comments?limit=20");
  });

  it("renders no empty placeholder when there are no approved comments", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          comments: [],
          nextCursor: null,
          stats: { total: 0, averageRating: null },
        }),
      ),
    );

    const { container } = render(<TestimonialsMarquee />);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(container).toBeEmptyDOMElement();
  });
});

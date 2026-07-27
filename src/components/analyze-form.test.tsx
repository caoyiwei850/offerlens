import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnalyzeForm } from "./analyze-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AnalyzeForm", () => {
  it("offers text, PDF/DOCX, JD, and a clear analysis action", () => {
    render(<AnalyzeForm />);

    expect(screen.getByLabelText("粘贴简历内容")).toHaveAttribute("maxlength", "8000");
    expect(screen.getByLabelText("上传 PDF 或 DOCX 简历")).toHaveAttribute(
      "accept",
      ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(screen.getByLabelText("目标岗位描述")).toHaveAttribute("maxlength", "5000");
    expect(screen.getByLabelText("职业领域")).toHaveValue("AUTO");
    expect(screen.getByRole("option", { name: "医疗健康与照护" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "工程制造与技术工种" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始模拟" })).toBeEnabled();
    expect(
      screen.getByText("AI 模拟招聘判断，不代表真实招聘结果"),
    ).toBeInTheDocument();
  });
});

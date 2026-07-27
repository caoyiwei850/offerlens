import { describe, expect, it, vi } from "vitest";

import { parseResumeInput } from "./parse-resume";

const deps = {
  extractPdf: vi.fn(async () => "PDF 简历内容"),
  extractDocx: vi.fn(async () => "DOCX 简历内容"),
};

describe("parseResumeInput", () => {
  it("normalizes pasted resume text", async () => {
    const result = await parseResumeInput({ resumeText: "  张三\r\n\r\n后端工程师  " }, deps);

    expect(result).toBe("张三\n\n后端工程师");
  });

  it("extracts a PDF resume", async () => {
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });

    await expect(parseResumeInput({ resumeFile: file }, deps)).resolves.toBe("PDF 简历内容");
    expect(deps.extractPdf).toHaveBeenCalledOnce();
  });

  it("extracts a DOCX resume", async () => {
    const file = new File(["docx"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await expect(parseResumeInput({ resumeFile: file }, deps)).resolves.toBe("DOCX 简历内容");
    expect(deps.extractDocx).toHaveBeenCalledOnce();
  });

  it("rejects ambiguous, unsupported, oversized, empty, or overlong input", async () => {
    const pdf = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const unsupported = new File(["x"], "resume.txt", { type: "text/plain" });
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "resume.pdf", {
      type: "application/pdf",
    });

    await expect(
      parseResumeInput({ resumeText: "text", resumeFile: pdf }, deps),
    ).rejects.toThrow("只能选择一种简历输入方式");
    await expect(parseResumeInput({ resumeFile: unsupported }, deps)).rejects.toThrow(
      "仅支持 PDF 或 DOCX",
    );
    await expect(parseResumeInput({ resumeFile: oversized }, deps)).rejects.toThrow(
      "不能超过 10 MB",
    );
    await expect(parseResumeInput({}, deps)).rejects.toThrow("请粘贴或上传简历");
    await expect(parseResumeInput({ resumeText: "字".repeat(8001) }, deps)).rejects.toThrow(
      "不能超过 8,000 字符",
    );
  });
});

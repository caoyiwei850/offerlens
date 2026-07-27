// @vitest-environment node

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";

import {
  assertResumeExportable,
  generateResumeDocx,
  generateResumePdf,
} from "./export";
import type { ResumeDraft, TemplateId } from "./types";

const draft: ResumeDraft = {
  basics: {
    name: "张三",
    phone: "13888888888",
    email: "zhangsan@example.com",
    location: "武汉",
    targetRole: "市场运营专员",
    summary: "具备交易系统与故障治理经验。",
  },
  education: [
    {
      id: "education-1",
      school: "武汉大学",
      degree: "本科",
      major: "计算机科学",
      startDate: "2017.09",
      endDate: "2021.06",
      details: [],
    },
  ],
  experiences: [
    {
      id: "experience-1",
      organization: "示例科技",
      title: "市场运营专员",
      startDate: "2021.07",
      endDate: "至今",
      type: "FULL_TIME",
      bullets: [
        {
          id: "bullet-1",
          text: "主导交易系统限流改造，提升高峰期稳定性。",
          factRefs: ["source-001"],
          status: "AI_REWRITE",
        },
      ],
    },
  ],
  projects: [],
  skills: ["市场调研", "数据分析", "用户增长", "Redis"],
  certificates: [],
};

describe("resume export", () => {
  it.each(["PROFESSIONAL", "EXPERIENCE", "CAMPUS"] as TemplateId[])(
    "creates searchable PDF and editable DOCX for %s template",
    async (template) => {
      const pdf = await generateResumePdf(draft, template);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      const parser = new PDFParse({ data: new Uint8Array(pdf) });
      const pdfText = await parser.getText();
      await parser.destroy();
      expect(pdfText.text).toContain("张三");
      expect(pdfText.text).toContain("交易系统限流改造");

      const docx = await generateResumeDocx(draft, template);
      const docxText = await mammoth.extractRawText({ buffer: docx });
      expect(docxText.value).toContain("张三");
      expect(docxText.value).toContain("交易系统限流改造");
    },
    20_000,
  );

  it("blocks export when unresolved facts remain", () => {
    expect(() =>
      assertResumeExportable(
        {
          ...draft,
          experiences: [
            {
              ...draft.experiences[0],
              bullets: [
                {
                  ...draft.experiences[0].bullets[0],
                  status: "NEEDS_INPUT",
                },
              ],
            },
          ],
        },
        [],
      ),
    ).toThrow("待确认");
  });
});

import { existsSync } from "node:fs";
import path from "node:path";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageOrientation,
  Paragraph,
  TextRun,
} from "docx";
import PDFDocument from "pdfkit";

import {
  collectDraftBullets,
} from "./facts";
import type {
  ConsistencyIssue,
  ResumeDraft,
  TemplateId,
} from "./types";
import {
  RESUME_TEMPLATES,
  type TemplateTokens,
} from "./templates";

function resolveFont(filename: string): string {
  const standaloneAsset = path.join(
    process.cwd(),
    "assets",
    "fonts",
    filename,
  );
  if (existsSync(standaloneAsset)) {
    return standaloneAsset;
  }

  return path.join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "noto-sans-sc",
    "files",
    filename,
  );
}

const regularFont = resolveFont(
  "noto-sans-sc-chinese-simplified-400-normal.woff",
);
const boldFont = resolveFont(
  "noto-sans-sc-chinese-simplified-700-normal.woff",
);

export function assertResumeExportable(
  draft: ResumeDraft,
  unresolvedIssues: ConsistencyIssue[],
): void {
  if (
    unresolvedIssues.some(
      (item) => item.severity === "BLOCKING" && !item.resolved,
    )
  ) {
    throw new Error("仍有阻断问题未解决，暂时不能导出");
  }
  if (
    collectDraftBullets(draft).some(
      (bullet) => bullet.status === "NEEDS_INPUT",
    )
  ) {
    throw new Error("仍有待确认的简历内容，暂时不能导出");
  }
  if (!draft.basics.name && !draft.basics.targetRole) {
    throw new Error("请至少填写姓名或目标岗位");
  }
}

function contactLine(draft: ResumeDraft): string {
  return [
    draft.basics.phone,
    draft.basics.email,
    draft.basics.location,
    draft.basics.targetRole,
  ]
    .filter(Boolean)
    .join("  |  ");
}

type DocxBlock = Paragraph;

function docxHeading(title: string, accent: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 180, after: 80 },
    keepNext: true,
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 24,
        color: accent,
        font: "Noto Sans SC",
      }),
    ],
  });
}

function docxBullet(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "resume-bullets", level: 0 },
    spacing: { after: 60, line: 276 },
    children: [new TextRun({ text, size: 21, font: "Noto Sans SC" })],
  });
}

function docxEntryTitle(left: string, right: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 40 },
    keepNext: true,
    tabStops: [{ type: "right", position: 9_360 }],
    children: [
      new TextRun({
        text: left,
        bold: true,
        size: 22,
        font: "Noto Sans SC",
      }),
      new TextRun({ text: `\t${right}`, size: 20, color: "64748B" }),
    ],
  });
}

function buildDocxSection(
  section: TemplateTokens["sectionOrder"][number],
  draft: ResumeDraft,
  accent: string,
): DocxBlock[] {
  if (section === "summary" && draft.basics.summary) {
    return [
      docxHeading("个人简介", accent),
      new Paragraph({
        spacing: { after: 80, line: 276 },
        children: [
          new TextRun({
            text: draft.basics.summary,
            size: 21,
            font: "Noto Sans SC",
          }),
        ],
      }),
    ];
  }
  if (section === "skills" && draft.skills.length) {
    return [
      docxHeading("专业技能", accent),
      docxBullet(draft.skills.join(" · ")),
    ];
  }
  if (section === "experience" && draft.experiences.length) {
    return [
      docxHeading("工作与实习经历", accent),
      ...draft.experiences.flatMap((entry) => [
        docxEntryTitle(
          [entry.organization, entry.title].filter(Boolean).join("｜"),
          [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
        ),
        ...entry.bullets.map((bullet) => docxBullet(bullet.text)),
      ]),
    ];
  }
  if (section === "projects" && draft.projects.length) {
    return [
      docxHeading("项目经历", accent),
      ...draft.projects.flatMap((entry) => [
        docxEntryTitle(
          [entry.name, entry.role].filter(Boolean).join("｜"),
          [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
        ),
        ...entry.bullets.map((bullet) => docxBullet(bullet.text)),
      ]),
    ];
  }
  if (section === "education" && draft.education.length) {
    return [
      docxHeading("教育经历", accent),
      ...draft.education.flatMap((entry) => [
        docxEntryTitle(
          [entry.school, entry.degree, entry.major].filter(Boolean).join("｜"),
          [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
        ),
        ...entry.details.map(docxBullet),
      ]),
    ];
  }
  if (section === "certificates" && draft.certificates.length) {
    return [
      docxHeading("证书与补充信息", accent),
      ...draft.certificates.map(docxBullet),
    ];
  }
  return [];
}

export async function generateResumeDocx(
  draft: ResumeDraft,
  template: TemplateId,
): Promise<Buffer> {
  const tokens = RESUME_TEMPLATES[template];
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: draft.basics.name || draft.basics.targetRole,
          bold: true,
          size: 36,
          color: "0F172A",
          font: "Noto Sans SC",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: contactLine(draft),
          size: 19,
          color: "475569",
          font: "Noto Sans SC",
        }),
      ],
    }),
    ...tokens.sectionOrder.flatMap((section) =>
      buildDocxSection(section, draft, tokens.accent),
    ),
  ];

  const document = new Document({
    creator: "OfferLens",
    title: `${draft.basics.name || draft.basics.targetRole} - 简历`,
    description: "OfferLens 证据化简历工作台导出",
    styles: {
      default: {
        document: {
          run: { font: "Noto Sans SC", size: 21, color: "1E293B" },
          paragraph: { spacing: { after: 80, line: 276 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "resume-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 360, hanging: 180 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12_240,
              height: 15_840,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 936,
              right: 936,
              bottom: 936,
              left: 936,
              header: 480,
              footer: 480,
            },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

function pdfSectionTitle(
  document: PDFKit.PDFDocument,
  title: string,
  accent: string,
): void {
  document.moveDown(0.55);
  const y = document.y;
  document
    .font("ResumeBold")
    .fontSize(12)
    .fillColor(`#${accent}`)
    .text(title, 47, y, { width: 518 });
  document
    .moveTo(47, document.y + 2)
    .lineTo(565, document.y + 2)
    .strokeColor(`#${accent}`)
    .lineWidth(0.6)
    .stroke();
  document.x = 47;
  document.moveDown(0.45);
}

function pdfBullet(document: PDFKit.PDFDocument, text: string): void {
  const y = document.y;
  document
    .font("ResumeRegular")
    .fontSize(10)
    .fillColor("#334155")
    .text(`• ${text}`, 47, y, {
      width: 518,
      indent: 10,
      paragraphGap: 3,
      lineGap: 2,
    });
  document.x = 47;
}

function pdfEntryTitle(
  document: PDFKit.PDFDocument,
  left: string,
  right: string,
): void {
  const y = document.y;
  document.font("ResumeBold").fontSize(10.5).fillColor("#0F172A").text(left, 47, y, {
    width: 360,
  });
  document
    .font("ResumeRegular")
    .fontSize(9)
    .fillColor("#64748B")
    .text(right, 407, y, { width: 158, align: "right" });
  document.y = Math.max(document.y, y + 16);
  document.x = 47;
}

function renderPdfSection(
  document: PDFKit.PDFDocument,
  section: TemplateTokens["sectionOrder"][number],
  draft: ResumeDraft,
  accent: string,
): void {
  if (section === "summary" && draft.basics.summary) {
    pdfSectionTitle(document, "个人简介", accent);
    document
      .font("ResumeRegular")
      .fontSize(10)
      .fillColor("#334155")
      .text(draft.basics.summary, 47, document.y, {
        width: 518,
        lineGap: 2,
      });
    document.x = 47;
  } else if (section === "skills" && draft.skills.length) {
    pdfSectionTitle(document, "专业技能", accent);
    pdfBullet(document, draft.skills.join(" · "));
  } else if (section === "experience" && draft.experiences.length) {
    pdfSectionTitle(document, "工作与实习经历", accent);
    for (const entry of draft.experiences) {
      pdfEntryTitle(
        document,
        [entry.organization, entry.title].filter(Boolean).join("｜"),
        [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
      );
      entry.bullets.forEach((bullet) => pdfBullet(document, bullet.text));
      document.moveDown(0.2);
    }
  } else if (section === "projects" && draft.projects.length) {
    pdfSectionTitle(document, "项目经历", accent);
    for (const entry of draft.projects) {
      pdfEntryTitle(
        document,
        [entry.name, entry.role].filter(Boolean).join("｜"),
        [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
      );
      entry.bullets.forEach((bullet) => pdfBullet(document, bullet.text));
    }
  } else if (section === "education" && draft.education.length) {
    pdfSectionTitle(document, "教育经历", accent);
    for (const entry of draft.education) {
      pdfEntryTitle(
        document,
        [entry.school, entry.degree, entry.major].filter(Boolean).join("｜"),
        [entry.startDate, entry.endDate].filter(Boolean).join(" - "),
      );
      entry.details.forEach((detail) => pdfBullet(document, detail));
    }
  } else if (section === "certificates" && draft.certificates.length) {
    pdfSectionTitle(document, "证书与补充信息", accent);
    draft.certificates.forEach((item) => pdfBullet(document, item));
  }
}

export function generateResumePdf(
  draft: ResumeDraft,
  template: TemplateId,
): Promise<Buffer> {
  const tokens = RESUME_TEMPLATES[template];
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "LETTER",
      margins: { top: 47, right: 47, bottom: 47, left: 47 },
      info: {
        Title: `${draft.basics.name || draft.basics.targetRole} - 简历`,
        Author: draft.basics.name,
        Creator: "OfferLens",
      },
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.registerFont("ResumeRegular", regularFont);
    document.registerFont("ResumeBold", boldFont);

    document
      .font("ResumeBold")
      .fontSize(20)
      .fillColor("#0F172A")
      .text(draft.basics.name || draft.basics.targetRole, { align: "center" });
    document
      .font("ResumeRegular")
      .fontSize(9)
      .fillColor("#475569")
      .text(contactLine(draft), 47, document.y, {
        width: 518,
        align: "center",
      });
    document.x = 47;
    tokens.sectionOrder.forEach((section) =>
      renderPdfSection(document, section, draft, tokens.accent),
    );
    document.end();
  });
}

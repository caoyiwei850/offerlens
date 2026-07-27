import DOMMatrixPolyfill from "@thednp/dommatrix";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_RESUME_CHARACTERS = 8_000;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface ResumeInput {
  resumeText?: string;
  resumeFile?: File;
}

interface ResumeExtractors {
  extractPdf: (bytes: Uint8Array) => Promise<string>;
  extractDocx: (bytes: Uint8Array) => Promise<string>;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis.DOMMatrix === "undefined") {
    Object.defineProperty(globalThis, "DOMMatrix", {
      configurable: true,
      value: DOMMatrixPolyfill,
      writable: true,
    });
  }
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

const defaultExtractors: ResumeExtractors = { extractPdf, extractDocx };

function getFileKind(file: File): "pdf" | "docx" | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (file.type === DOCX_MIME || name.endsWith(".docx")) {
    return "docx";
  }
  return null;
}

export async function parseResumeInput(
  { resumeText, resumeFile }: ResumeInput,
  extractors: ResumeExtractors = defaultExtractors,
): Promise<string> {
  const hasText = Boolean(resumeText?.trim());
  if (hasText && resumeFile) {
    throw new Error("只能选择一种简历输入方式");
  }
  if (!hasText && !resumeFile) {
    throw new Error("请粘贴或上传简历");
  }

  let value: string;
  if (resumeFile) {
    if (resumeFile.size > MAX_FILE_BYTES) {
      throw new Error("简历文件不能超过 10 MB");
    }
    const kind = getFileKind(resumeFile);
    if (!kind) {
      throw new Error("仅支持 PDF 或 DOCX 简历");
    }
    const bytes = new Uint8Array(await resumeFile.arrayBuffer());
    value =
      kind === "pdf"
        ? await extractors.extractPdf(bytes)
        : await extractors.extractDocx(bytes);
  } else {
    value = resumeText ?? "";
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error("没有从简历中读取到有效文本");
  }
  if (normalized.length > MAX_RESUME_CHARACTERS) {
    throw new Error("简历内容不能超过 8,000 字符");
  }
  return normalized;
}

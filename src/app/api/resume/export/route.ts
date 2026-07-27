import {
  assertResumeExportable,
  generateResumeDocx,
  generateResumePdf,
} from "@/lib/resume-workbench/export";
import { apiError } from "@/lib/resume-workbench/route-utils";
import { resumeExportRequestSchema } from "@/lib/resume-workbench/types";

export const runtime = "nodejs";

function safeFilename(value: string): string {
  return (value || "OfferLens简历").replace(/[\\/:*?"<>|\r\n]/g, "").slice(0, 60);
}

export async function POST(request: Request): Promise<Response> {
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "pdf" && format !== "docx") {
    return apiError(400, "INVALID_FORMAT", "导出格式必须为 PDF 或 DOCX");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_INPUT", "请求格式无效");
  }
  const parsed = resumeExportRequestSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "简历数据无效");
  try {
    assertResumeExportable(parsed.data.draft, parsed.data.unresolvedIssues);
    const buffer =
      format === "pdf"
        ? await generateResumePdf(parsed.data.draft, parsed.data.template)
        : await generateResumeDocx(parsed.data.draft, parsed.data.template);
    const filename = `${safeFilename(parsed.data.draft.basics.name)}-简历.${format}`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(
      400,
      "EXPORT_BLOCKED",
      error instanceof Error ? error.message : "简历导出失败",
    );
  }
}

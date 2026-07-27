import { parseResumeInput } from "@/lib/resume/parse-resume";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "上传格式无效" } },
      { status: 400 },
    );
  }

  const value = form.get("resumeFile");
  if (!(value instanceof File) || value.size === 0) {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "请选择 PDF 或 DOCX 简历" } },
      { status: 400 },
    );
  }

  try {
    const resumeText = await parseResumeInput({ resumeFile: value });
    return Response.json(
      { resumeText },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: {
          code: "INVALID_RESUME",
          message: error instanceof Error ? error.message : "简历读取失败",
        },
      },
      { status: 400 },
    );
  }
}

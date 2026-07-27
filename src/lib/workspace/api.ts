import { getSessionUser } from "@/lib/auth/session";
import { getWorkspaceRepository } from "./repository-instance";
import {
  applicationInputSchema,
  importSessionSchema,
  interviewPackSchema,
  resumeProfileInputSchema,
  resumeVersionInputSchema,
  reviewReportSchema,
} from "./types";
import type { WorkspaceRepository } from "./repository";
import {
  buildFallbackInterviewPack,
  buildFallbackReview,
  callInterviewPackModel,
  callReviewModel,
  type InterviewModelInput,
  type ReviewModelInput,
} from "@/lib/career/model";

export function workspaceError(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export interface WorkspaceDependencies {
  repository: WorkspaceRepository;
  getUser: (request: Request) => { id: string; email: string } | null;
}

export function defaultWorkspaceDependencies(): WorkspaceDependencies {
  return {
    repository: getWorkspaceRepository(),
    getUser: getSessionUser,
  };
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function createResumeProfilesHandlers(dependencies: WorkspaceDependencies) {
  return {
    GET(request: Request): Response {
      const user = dependencies.getUser(request);
      if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
      return Response.json(
        { resumes: dependencies.repository.listResumeProfiles(user.id) },
        { headers: { "Cache-Control": "no-store" } },
      );
    },

    async POST(request: Request): Promise<Response> {
      const user = dependencies.getUser(request);
      if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
      const parsed = resumeProfileInputSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        return workspaceError(400, "INVALID_INPUT", "简历资料无效");
      }
      return Response.json(
        { resume: dependencies.repository.createResumeProfile(user.id, parsed.data) },
        { headers: { "Cache-Control": "no-store" } },
      );
    },
  };
}

export function createApplicationsHandlers(dependencies: WorkspaceDependencies) {
  return {
    GET(request: Request): Response {
      const user = dependencies.getUser(request);
      if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
      return Response.json(
        { applications: dependencies.repository.listApplications(user.id) },
        { headers: { "Cache-Control": "no-store" } },
      );
    },

    async POST(request: Request): Promise<Response> {
      const user = dependencies.getUser(request);
      if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
      const parsed = applicationInputSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        return workspaceError(400, "INVALID_INPUT", "岗位工作区数据无效");
      }
      return Response.json(
        { application: dependencies.repository.createApplication(user.id, parsed.data) },
        { headers: { "Cache-Control": "no-store" } },
      );
    },
  };
}

export function createImportSessionHandler(dependencies: WorkspaceDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const user = dependencies.getUser(request);
    if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
    const parsed = importSessionSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return workspaceError(400, "INVALID_INPUT", "当前会话资料无效");
    }
    return Response.json(
      { application: dependencies.repository.importSession(user.id, parsed.data) },
      { headers: { "Cache-Control": "no-store" } },
    );
  };
}

export function createResumeVersionsHandlers(dependencies: WorkspaceDependencies) {
  return {
    GET(request: Request, applicationId: string): Response {
      const user = dependencies.getUser(request);
      if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
      const application = dependencies.repository.getApplication(user.id, applicationId);
      if (!application) return workspaceError(404, "NOT_FOUND", "岗位工作区不存在");
      return Response.json(
        { resumeVersions: application.resumeVersions },
        { headers: { "Cache-Control": "no-store" } },
      );
    },

    async POST(request: Request, applicationId: string): Promise<Response> {
      const user = dependencies.getUser(request);
      if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
      const parsed = resumeVersionInputSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        return workspaceError(400, "INVALID_INPUT", "简历版本数据无效");
      }
      const version = dependencies.repository.createResumeVersion(
        user.id,
        applicationId,
        parsed.data,
      );
      if (!version) return workspaceError(404, "NOT_FOUND", "岗位工作区不存在");
      return Response.json(
        { resumeVersion: version },
        { headers: { "Cache-Control": "no-store" } },
      );
    },
  };
}

interface ModelDependencies extends WorkspaceDependencies {
  callReview: (input: ReviewModelInput) => Promise<string>;
  callInterviewPack: (input: InterviewModelInput) => Promise<string>;
}

export function defaultModelDependencies(): ModelDependencies {
  return {
    ...defaultWorkspaceDependencies(),
    callReview: (input) =>
      callReviewModel(input, { apiKey: process.env.DEEPSEEK_API_KEY ?? "" }),
    callInterviewPack: (input) =>
      callInterviewPackModel(input, {
        apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      }),
  };
}

export function createReviewHandler(dependencies: ModelDependencies) {
  return async function POST(request: Request, applicationId: string): Promise<Response> {
    const user = dependencies.getUser(request);
    if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
    const body = (await readJson(request)) as { resumeVersionId?: string } | null;
    const resumeVersionId = body?.resumeVersionId;
    if (!resumeVersionId) {
      return workspaceError(400, "INVALID_INPUT", "请选择简历版本");
    }
    const application = dependencies.repository.getApplication(user.id, applicationId);
    const version = application?.resumeVersions.find((item) => item.id === resumeVersionId);
    if (!application || !version) {
      return workspaceError(404, "NOT_FOUND", "简历版本不存在");
    }
    const input = {
      jobDescription: application.jobSnapshot.description,
      analysis: application.analysis,
      resumeVersion: version.draft,
      facts: version.facts,
    };
    let report;
    try {
      report = reviewReportSchema.parse(JSON.parse(await dependencies.callReview(input)));
    } catch {
      report = buildFallbackReview(input);
    }
    const record = dependencies.repository.createReviewReport(
      user.id,
      applicationId,
      resumeVersionId,
      report,
    );
    return Response.json(
      { reviewReport: record },
      { headers: { "Cache-Control": "no-store" } },
    );
  };
}

export function createInterviewPackHandler(dependencies: ModelDependencies) {
  return async function POST(request: Request, applicationId: string): Promise<Response> {
    const user = dependencies.getUser(request);
    if (!user) return workspaceError(401, "UNAUTHORIZED", "请先登录");
    const body = (await readJson(request)) as { resumeVersionId?: string } | null;
    const resumeVersionId = body?.resumeVersionId;
    if (!resumeVersionId) {
      return workspaceError(400, "INVALID_INPUT", "请选择简历版本");
    }
    const application = dependencies.repository.getApplication(user.id, applicationId);
    const version = application?.resumeVersions.find((item) => item.id === resumeVersionId);
    if (!application || !version) {
      return workspaceError(404, "NOT_FOUND", "简历版本不存在");
    }
    const input = {
      jobDescription: application.jobSnapshot.description,
      analysis: application.analysis,
      resumeVersion: version.draft,
      facts: version.facts,
      reviewReports: application.reviewReports.map((item) => item.report),
    };
    let pack;
    try {
      pack = interviewPackSchema.parse(
        JSON.parse(await dependencies.callInterviewPack(input)),
      );
    } catch {
      pack = buildFallbackInterviewPack();
    }
    const record = dependencies.repository.createInterviewPack(
      user.id,
      applicationId,
      resumeVersionId,
      pack,
    );
    return Response.json(
      { interviewPack: record },
      { headers: { "Cache-Control": "no-store" } },
    );
  };
}

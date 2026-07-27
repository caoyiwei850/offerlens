import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  ApplicationDetails,
  ApplicationInput,
  ApplicationWorkspace,
  ImportSessionInput,
  InterviewPack,
  InterviewPackRecord,
  JobSnapshot,
  ResumeProfile,
  ResumeProfileInput,
  ResumeVersion,
  ResumeVersionInput,
  ReviewReport,
  ReviewReportRecord,
} from "./types";
import type { Fact, ResumeDraft } from "@/lib/resume-workbench/types";
import { buildResumeProfileTitle } from "./resume-profile-label";

export interface WorkspaceRepository {
  createResumeProfile(userId: string, input: ResumeProfileInput): ResumeProfile;
  listResumeProfiles(userId: string): ResumeProfile[];
  createApplication(userId: string, input: ApplicationInput): ApplicationDetails;
  importSession(userId: string, input: ImportSessionInput): ApplicationDetails;
  listApplications(userId: string): ApplicationDetails[];
  getApplication(userId: string, id: string): ApplicationDetails | null;
  createResumeVersion(
    userId: string,
    applicationId: string,
    input: ResumeVersionInput,
  ): ResumeVersion | null;
  createReviewReport(
    userId: string,
    applicationId: string,
    resumeVersionId: string,
    report: ReviewReport,
  ): ReviewReportRecord | null;
  createInterviewPack(
    userId: string,
    applicationId: string,
    resumeVersionId: string,
    pack: InterviewPack,
  ): InterviewPackRecord | null;
  close(): void;
}

interface RepositoryOptions {
  path: string;
  createId?: () => string;
  now?: () => string;
}

type Row = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeResumeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function firstMeaningfulLine(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function factsFromResumeText(resumeText: string): Fact[] {
  return resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((text, index) => ({
      id: `source-${String(index + 1).padStart(3, "0")}`,
      text: text.slice(0, 1_000),
      source: "RESUME" as const,
    }));
}

function draftFromResumeText(
  resumeText: string,
  targetRole: string,
): { draft: ResumeDraft; facts: Fact[] } {
  const facts = factsFromResumeText(resumeText);
  const firstLine = firstMeaningfulLine(resumeText);
  const summary = normalizeResumeText(resumeText).slice(0, 2_000);
  return {
    facts,
    draft: {
      basics: {
        name: firstLine.slice(0, 200),
        phone: "",
        email: "",
        location: "",
        targetRole,
        summary: summary || "已导入的原始简历文本。",
      },
      education: [],
      experiences: [],
      projects: [],
      skills: [],
      certificates: [],
    },
  };
}

function profileFromRow(row: Row): ResumeProfile {
  return {
    id: String(row.id),
    title: String(row.title),
    resumeText: String(row.resumeText),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function jobFromRow(row: Row): JobSnapshot {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    createdAt: String(row.createdAt),
  };
}

function applicationFromRow(row: Row): ApplicationWorkspace {
  return {
    id: String(row.id),
    resumeProfileId: String(row.resumeProfileId),
    jobSnapshotId: String(row.jobSnapshotId),
    title: String(row.title),
    analysis: parseJson(row.analysisJson, null),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function versionFromRow(row: Row): ResumeVersion {
  return {
    id: String(row.id),
    applicationId: String(row.applicationId),
    title: String(row.title),
    draft: parseJson(row.draftJson, {}),
    facts: parseJson(row.factsJson, []),
    source: row.source as ResumeVersion["source"],
    createdAt: String(row.createdAt),
  };
}

function reviewFromRow(row: Row): ReviewReportRecord {
  return {
    id: String(row.id),
    applicationId: String(row.applicationId),
    resumeVersionId: String(row.resumeVersionId),
    report: parseJson(row.reportJson, { summary: "", issues: [], safeRewriteNotes: [] }),
    createdAt: String(row.createdAt),
  };
}

function packFromRow(row: Row): InterviewPackRecord {
  return {
    id: String(row.id),
    applicationId: String(row.applicationId),
    resumeVersionId: String(row.resumeVersionId),
    pack: parseJson(row.packJson, { summary: "", questions: [] }),
    createdAt: String(row.createdAt),
  };
}

export function createWorkspaceRepository({
  path: databasePath,
  createId = randomUUID,
  now = () => new Date().toISOString(),
}: RepositoryOptions): WorkspaceRepository {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS resume_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      resume_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS resume_profiles_user_idx
      ON resume_profiles(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS job_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS job_snapshots_user_idx
      ON job_snapshots(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS application_workspaces (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resume_profile_id TEXT NOT NULL,
      job_snapshot_id TEXT NOT NULL,
      title TEXT NOT NULL,
      analysis_json TEXT,
      client_import_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, client_import_id)
    );
    CREATE INDEX IF NOT EXISTS application_workspaces_user_idx
      ON application_workspaces(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      title TEXT NOT NULL,
      draft_json TEXT NOT NULL,
      facts_json TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('MANUAL', 'AI_REWRITE', 'IMPORTED')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS resume_versions_application_idx
      ON resume_versions(user_id, application_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS review_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      resume_version_id TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS review_reports_application_idx
      ON review_reports(user_id, application_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS interview_packs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      resume_version_id TEXT NOT NULL,
      pack_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS interview_packs_application_idx
      ON interview_packs(user_id, application_id, created_at DESC);
  `);

  const insertProfile = database.prepare(`
    INSERT INTO resume_profiles (id, user_id, title, resume_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const listProfiles = database.prepare(`
    SELECT id, title, resume_text AS resumeText, created_at AS createdAt, updated_at AS updatedAt
    FROM resume_profiles
    WHERE user_id = ?
    ORDER BY updated_at DESC, id DESC
  `);
  const getProfile = database.prepare(`
    SELECT id, title, resume_text AS resumeText, created_at AS createdAt, updated_at AS updatedAt
    FROM resume_profiles
    WHERE user_id = ? AND id = ?
  `);
  const listProfilesForReuse = database.prepare(`
    SELECT id, title, resume_text AS resumeText, created_at AS createdAt, updated_at AS updatedAt
    FROM resume_profiles
    WHERE user_id = ?
    ORDER BY updated_at DESC, id DESC
  `);
  const insertJob = database.prepare(`
    INSERT INTO job_snapshots (id, user_id, title, description, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const getJob = database.prepare(`
    SELECT id, title, description, created_at AS createdAt
    FROM job_snapshots
    WHERE user_id = ? AND id = ?
  `);
  const insertApplication = database.prepare(`
    INSERT INTO application_workspaces (
      id, user_id, resume_profile_id, job_snapshot_id, title,
      analysis_json, client_import_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const listApplications = database.prepare(`
    SELECT
      id,
      resume_profile_id AS resumeProfileId,
      job_snapshot_id AS jobSnapshotId,
      title,
      analysis_json AS analysisJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM application_workspaces
    WHERE user_id = ?
    ORDER BY updated_at DESC, id DESC
  `);
  const getApplication = database.prepare(`
    SELECT
      id,
      resume_profile_id AS resumeProfileId,
      job_snapshot_id AS jobSnapshotId,
      title,
      analysis_json AS analysisJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM application_workspaces
    WHERE user_id = ? AND id = ?
  `);
  const getApplicationByImport = database.prepare(`
    SELECT
      id,
      resume_profile_id AS resumeProfileId,
      job_snapshot_id AS jobSnapshotId,
      title,
      analysis_json AS analysisJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM application_workspaces
    WHERE user_id = ? AND client_import_id = ?
  `);
  const insertVersion = database.prepare(`
    INSERT INTO resume_versions (
      id, user_id, application_id, title, draft_json, facts_json, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const listVersions = database.prepare(`
    SELECT
      id,
      application_id AS applicationId,
      title,
      draft_json AS draftJson,
      facts_json AS factsJson,
      source,
      created_at AS createdAt
    FROM resume_versions
    WHERE user_id = ? AND application_id = ?
    ORDER BY created_at DESC, id DESC
  `);
  const getVersion = database.prepare(`
    SELECT
      id,
      application_id AS applicationId,
      title,
      draft_json AS draftJson,
      facts_json AS factsJson,
      source,
      created_at AS createdAt
    FROM resume_versions
    WHERE user_id = ? AND application_id = ? AND id = ?
  `);
  const insertReview = database.prepare(`
    INSERT INTO review_reports (
      id, user_id, application_id, resume_version_id, report_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const listReviews = database.prepare(`
    SELECT
      id,
      application_id AS applicationId,
      resume_version_id AS resumeVersionId,
      report_json AS reportJson,
      created_at AS createdAt
    FROM review_reports
    WHERE user_id = ? AND application_id = ?
    ORDER BY created_at DESC, id DESC
  `);
  const insertPack = database.prepare(`
    INSERT INTO interview_packs (
      id, user_id, application_id, resume_version_id, pack_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const listPacks = database.prepare(`
    SELECT
      id,
      application_id AS applicationId,
      resume_version_id AS resumeVersionId,
      pack_json AS packJson,
      created_at AS createdAt
    FROM interview_packs
    WHERE user_id = ? AND application_id = ?
    ORDER BY created_at DESC, id DESC
  `);

  function createProfile(userId: string, input: ResumeProfileInput): ResumeProfile {
    const normalizedInput = normalizeResumeText(input.resumeText);
    const existing = (listProfilesForReuse.all(userId) as Row[]).find(
      (row) => normalizeResumeText(String(row.resumeText)) === normalizedInput,
    );
    if (existing) return profileFromRow(existing);

    const timestamp = now();
    const profile = {
      id: createId(),
      title: input.title,
      resumeText: input.resumeText,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    insertProfile.run(
      profile.id,
      userId,
      profile.title,
      profile.resumeText,
      profile.createdAt,
      profile.updatedAt,
    );
    return profile;
  }

  function createJob(userId: string, title: string, description: string): JobSnapshot {
    const job = {
      id: createId(),
      title,
      description,
      createdAt: now(),
    };
    insertJob.run(job.id, userId, job.title, job.description, job.createdAt);
    return job;
  }

  function details(userId: string, application: ApplicationWorkspace): ApplicationDetails {
    const profile = getProfile.get(userId, application.resumeProfileId) as Row | undefined;
    const job = getJob.get(userId, application.jobSnapshotId) as Row | undefined;
    if (!profile || !job) {
      throw new Error("Workspace references missing records");
    }
    return {
      ...application,
      resumeProfile: profileFromRow(profile),
      jobSnapshot: jobFromRow(job),
      resumeVersions: (listVersions.all(userId, application.id) as Row[]).map(versionFromRow),
      reviewReports: (listReviews.all(userId, application.id) as Row[]).map(reviewFromRow),
      interviewPacks: (listPacks.all(userId, application.id) as Row[]).map(packFromRow),
    };
  }

  return {
    createResumeProfile: createProfile,

    listResumeProfiles(userId) {
      return (listProfiles.all(userId) as Row[]).map(profileFromRow);
    },

    createApplication(userId, input) {
      const timestamp = now();
      const profile = input.resumeProfileId
        ? profileFromRow(getProfile.get(userId, input.resumeProfileId) as Row)
        : createProfile(userId, {
            title: input.title || "基础简历",
            resumeText: input.resumeText,
          });
      const job = createJob(
        userId,
        input.jobTitle || input.title || "目标岗位",
        input.jobDescription,
      );
      const application = {
        id: createId(),
        resumeProfileId: profile.id,
        jobSnapshotId: job.id,
        title: input.title || job.title,
        analysis: input.analysis ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      insertApplication.run(
        application.id,
        userId,
        application.resumeProfileId,
        application.jobSnapshotId,
        application.title,
        application.analysis ? JSON.stringify(application.analysis) : null,
        null,
        application.createdAt,
        application.updatedAt,
      );
      return details(userId, application);
    },

    importSession(userId, input) {
      const existing = getApplicationByImport.get(
        userId,
        input.clientImportId,
      ) as Row | undefined;
      if (existing) return details(userId, applicationFromRow(existing));

      const timestamp = now();
      const profile = createProfile(userId, {
        title:
          input.resumeTitle ||
          buildResumeProfileTitle({
            resumeText: input.resumeText,
            occupationName: input.analysis.evaluation_context.occupation_name,
            createdAt: timestamp,
          }),
        resumeText: input.resumeText,
      });
      const job = createJob(
        userId,
        input.jobTitle || input.analysis.evaluation_context.occupation_name || "目标岗位",
        input.jobDescription,
      );
      const application = {
        id: createId(),
        resumeProfileId: profile.id,
        jobSnapshotId: job.id,
        title: job.title,
        analysis: input.analysis,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      insertApplication.run(
        application.id,
        userId,
        application.resumeProfileId,
        application.jobSnapshotId,
        application.title,
        JSON.stringify(application.analysis),
        input.clientImportId,
        application.createdAt,
        application.updatedAt,
      );
      const fallbackVersion = draftFromResumeText(
        input.resumeText,
        input.analysis.evaluation_context.occupation_name || job.title,
      );
      const draft = input.rewritten?.draft ?? input.plan?.draft ?? fallbackVersion.draft;
      const facts = input.rewritten?.facts ?? input.plan?.facts ?? fallbackVersion.facts;
      insertVersion.run(
        createId(),
        userId,
        application.id,
        input.rewritten ? "改写简历" : input.plan ? "规划草稿" : "原始简历快照",
        JSON.stringify(draft),
        JSON.stringify(facts),
        "IMPORTED",
        now(),
      );
      return details(userId, application);
    },

    listApplications(userId) {
      return (listApplications.all(userId) as Row[])
        .map(applicationFromRow)
        .map((application) => details(userId, application));
    },

    getApplication(userId, id) {
      const row = getApplication.get(userId, id) as Row | undefined;
      return row ? details(userId, applicationFromRow(row)) : null;
    },

    createResumeVersion(userId, applicationId, input) {
      if (!getApplication.get(userId, applicationId)) return null;
      const version = {
        id: createId(),
        applicationId,
        title: input.title,
        draft: input.draft,
        facts: input.facts ?? [],
        source: input.source,
        createdAt: now(),
      };
      insertVersion.run(
        version.id,
        userId,
        version.applicationId,
        version.title,
        JSON.stringify(version.draft),
        JSON.stringify(version.facts),
        version.source,
        version.createdAt,
      );
      return version;
    },

    createReviewReport(userId, applicationId, resumeVersionId, report) {
      if (!getVersion.get(userId, applicationId, resumeVersionId)) return null;
      const record = {
        id: createId(),
        applicationId,
        resumeVersionId,
        report,
        createdAt: now(),
      };
      insertReview.run(
        record.id,
        userId,
        record.applicationId,
        record.resumeVersionId,
        JSON.stringify(record.report),
        record.createdAt,
      );
      return record;
    },

    createInterviewPack(userId, applicationId, resumeVersionId, pack) {
      if (!getVersion.get(userId, applicationId, resumeVersionId)) return null;
      const record = {
        id: createId(),
        applicationId,
        resumeVersionId,
        pack,
        createdAt: now(),
      };
      insertPack.run(
        record.id,
        userId,
        record.applicationId,
        record.resumeVersionId,
        JSON.stringify(record.pack),
        record.createdAt,
      );
      return record;
    },

    close() {
      database.close();
    },
  };
}

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  FeedbackEntry,
  FeedbackKind,
  FeedbackSubmission,
  InterviewOutcome,
  PredictionMatch,
} from "./types";

export interface CreateFeedbackInput {
  kind: FeedbackKind;
  outcome: InterviewOutcome | null;
  predictionMatch: PredictionMatch | null;
  rating: number;
  content: string;
  occupationFamily: string | null;
  deviceHash: string;
  ipHash: string;
}

export interface FeedbackRepository {
  create(input: CreateFeedbackInput): FeedbackSubmission;
  listRecent(limit: number): FeedbackEntry[];
  close(): void;
}

interface RepositoryOptions {
  path: string;
  createId?: () => string;
  now?: () => string;
}

interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  outcome: InterviewOutcome | null;
  predictionMatch: PredictionMatch | null;
  rating: number;
  content: string;
  occupationFamily: string | null;
  createdAt: string;
}

export function createFeedbackRepository({
  path: databasePath,
  createId = randomUUID,
  now = () => new Date().toISOString(),
}: RepositoryOptions): FeedbackRepository {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS feedback_entries (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL
        CHECK (kind IN ('INTERVIEW_OUTCOME', 'PRODUCT_SUGGESTION')),
      outcome TEXT
        CHECK (outcome IS NULL OR outcome IN ('ONGOING', 'OFFERED', 'REJECTED', 'WITHDREW')),
      prediction_match TEXT
        CHECK (prediction_match IS NULL OR prediction_match IN ('MATCHED', 'PARTLY_MATCHED', 'NOT_MATCHED', 'UNSURE')),
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      content TEXT NOT NULL,
      occupation_family TEXT,
      created_at TEXT NOT NULL,
      device_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS feedback_entries_created_idx
      ON feedback_entries(created_at DESC, id DESC);
  `);
  const insert = database.prepare(`
    INSERT INTO feedback_entries (
      id, kind, outcome, prediction_match, rating, content,
      occupation_family, created_at, device_hash, ip_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const listRecent = database.prepare(`
    SELECT
      id,
      kind,
      outcome,
      prediction_match AS predictionMatch,
      rating,
      content,
      occupation_family AS occupationFamily,
      created_at AS createdAt
    FROM feedback_entries
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `);

  return {
    create(input) {
      const submission: FeedbackSubmission = {
        id: createId(),
        status: "RECEIVED",
      };
      insert.run(
        submission.id,
        input.kind,
        input.outcome,
        input.predictionMatch,
        input.rating,
        input.content,
        input.occupationFamily,
        now(),
        input.deviceHash,
        input.ipHash,
      );
      return submission;
    },

    listRecent(limit) {
      return listRecent.all(limit) as unknown as FeedbackRow[];
    },

    close() {
      database.close();
    },
  };
}

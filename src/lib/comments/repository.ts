import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  CommentPage,
  CommentSubmission,
  ModerationDecision,
  PendingComment,
  PublicComment,
} from "./types";

export interface CreateCommentInput {
  nickname: string;
  rating: number;
  content: string;
  deviceHash: string;
  ipHash: string;
}

export interface CommentRepository {
  create(input: CreateCommentInput): CommentSubmission;
  list(input: { limit: number; cursor?: string | null }): CommentPage;
  listPending(limit: number): PendingComment[];
  moderate(id: string, decision: ModerationDecision): boolean;
  softDelete(id: string): boolean;
  close(): void;
}

interface RepositoryOptions {
  path: string;
  createId?: () => string;
  now?: () => string;
}

interface CommentRow {
  id: string;
  nickname: string;
  rating: number;
  content: string;
  createdAt: string;
}

interface CursorValue {
  createdAt: string;
  id: string;
}

function encodeCursor(comment: PublicComment): string {
  return Buffer.from(
    JSON.stringify({ createdAt: comment.createdAt, id: comment.id }),
  ).toString("base64url");
}

function decodeCursor(cursor: string): CursorValue {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as CursorValue).createdAt === "string" &&
      typeof (value as CursorValue).id === "string"
    ) {
      return value as CursorValue;
    }
  } catch {
    // Converted to one stable public error below.
  }
  throw new Error("评论游标无效");
}

function normalizeCommentRow(row: CommentRow): PublicComment {
  return {
    id: row.id,
    nickname: row.nickname,
    rating: row.rating,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function createCurrentSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DELETED')),
      moderated_at TEXT,
      deleted_at TEXT,
      device_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS comments_public_order_idx
      ON comments(status, created_at DESC, id DESC);
  `);
}

function initializeDatabase(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
  `);
  const existing = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'comments'")
    .get() as { sql?: string } | undefined;

  if (!existing) {
    createCurrentSchema(database);
    return;
  }
  if (!existing.sql?.includes("'visible'")) {
    createCurrentSchema(database);
    return;
  }

  database.exec(`
    BEGIN IMMEDIATE;
    ALTER TABLE comments RENAME TO comments_legacy;
    DROP INDEX IF EXISTS comments_public_order_idx;
    CREATE TABLE comments (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DELETED')),
      moderated_at TEXT,
      deleted_at TEXT,
      device_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL
    );
    INSERT INTO comments (
      id, nickname, rating, content, created_at, status,
      moderated_at, deleted_at, device_hash, ip_hash
    )
    SELECT
      id, nickname, rating, content, created_at,
      CASE status WHEN 'visible' THEN 'APPROVED' ELSE 'DELETED' END,
      CASE status WHEN 'visible' THEN created_at ELSE NULL END,
      deleted_at, device_hash, ip_hash
    FROM comments_legacy;
    DROP TABLE comments_legacy;
    CREATE INDEX comments_public_order_idx
      ON comments(status, created_at DESC, id DESC);
    COMMIT;
  `);
}

export function createCommentRepository({
  path: databasePath,
  createId = randomUUID,
  now = () => new Date().toISOString(),
}: RepositoryOptions): CommentRepository {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  initializeDatabase(database);

  const insert = database.prepare(`
    INSERT INTO comments (
      id, nickname, rating, content, created_at, status, device_hash, ip_hash
    ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `);
  const listFirstPage = database.prepare(`
    SELECT
      id, nickname, rating, content, created_at AS createdAt
    FROM comments
    WHERE status = 'APPROVED'
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `);
  const listAfterCursor = database.prepare(`
    SELECT
      id, nickname, rating, content, created_at AS createdAt
    FROM comments
    WHERE status = 'APPROVED'
      AND (created_at < ? OR (created_at = ? AND id < ?))
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `);
  const readStats = database.prepare(`
    SELECT COUNT(*) AS total, AVG(rating) AS averageRating
    FROM comments
    WHERE status = 'APPROVED'
  `);
  const listPending = database.prepare(`
    SELECT
      id, nickname, rating, content, created_at AS createdAt
    FROM comments
    WHERE status = 'PENDING'
    ORDER BY created_at ASC, id ASC
    LIMIT ?
  `);
  const moderate = database.prepare(`
    UPDATE comments
    SET status = ?, moderated_at = ?
    WHERE id = ? AND status != 'DELETED'
  `);
  const softDelete = database.prepare(`
    UPDATE comments
    SET status = 'DELETED', deleted_at = ?
    WHERE id = ? AND status != 'DELETED'
  `);

  return {
    create(input) {
      const createdAt = now();
      const submission: CommentSubmission = {
        id: createId(),
        status: "PENDING",
      };
      insert.run(
        submission.id,
        input.nickname,
        input.rating,
        input.content,
        createdAt,
        input.deviceHash,
        input.ipHash,
      );
      return submission;
    },

    moderate(id, decision) {
      return moderate.run(decision, now(), id).changes > 0;
    },

    list({ limit, cursor }) {
      const requestedRows = limit + 1;
      const cursorValue = cursor ? decodeCursor(cursor) : null;
      const rows = (
        cursorValue
          ? listAfterCursor.all(
              cursorValue.createdAt,
              cursorValue.createdAt,
              cursorValue.id,
              requestedRows,
            )
          : listFirstPage.all(requestedRows)
      ) as unknown as CommentRow[];
      const comments = rows.slice(0, limit).map(normalizeCommentRow);
      const hasMore = rows.length > limit;
      const statsRow = readStats.get() as unknown as {
        total: number;
        averageRating: number | null;
      };

      return {
        comments,
        nextCursor:
          hasMore && comments.length > 0
            ? encodeCursor(comments[comments.length - 1])
            : null,
        stats: {
          total: Number(statsRow.total),
          averageRating:
            statsRow.averageRating === null ? null : Number(statsRow.averageRating),
        },
      };
    },

    listPending(limit) {
      return (listPending.all(limit) as unknown as CommentRow[]).map((row) => ({
        ...normalizeCommentRow(row),
        status: "PENDING" as const,
      }));
    },

    softDelete(id) {
      return softDelete.run(now(), id).changes > 0;
    },

    close() {
      database.close();
    },
  };
}

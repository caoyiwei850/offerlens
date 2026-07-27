// @vitest-environment node

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import {
  createCommentRepository,
  type CommentRepository,
} from "./repository";

const repositories: CommentRepository[] = [];

function makeRepository(ids: string[], dates: string[]) {
  const repository = createCommentRepository({
    path: ":memory:",
    createId: () => ids.shift() ?? "fallback-id",
    now: () => dates.shift() ?? "2026-07-01T00:00:00.000Z",
  });
  repositories.push(repository);
  return repository;
}

afterEach(() => {
  repositories.splice(0).forEach((repository) => repository.close());
});

describe("CommentRepository", () => {
  it("keeps submissions private until approved and only counts approved comments", () => {
    const repository = makeRepository(
      ["comment-1", "comment-2"],
      ["2026-07-01T10:00:00.000Z", "2026-07-01T11:00:00.000Z"],
    );

    const first = repository.create({
      nickname: "小林",
      rating: 5,
      content: "评测很具体。",
      deviceHash: "device-a",
      ipHash: "ip-a",
    });
    const second = repository.create({
      nickname: "匿名用户",
      rating: 3,
      content: "希望增加更多岗位示例。",
      deviceHash: "device-b",
      ipHash: "ip-b",
    });

    expect(repository.list({ limit: 20 })).toEqual({
      comments: [],
      nextCursor: null,
      stats: { total: 0, averageRating: null },
    });
    expect(repository.listPending(20).map((comment) => comment.id)).toEqual([
      "comment-1",
      "comment-2",
    ]);
    expect(repository.listPending(20)[0]).not.toHaveProperty("deviceHash");
    expect(repository.listPending(20)[0]).not.toHaveProperty("ipHash");

    expect(repository.moderate(first.id, "APPROVED")).toBe(true);
    expect(repository.moderate(second.id, "REJECTED")).toBe(true);
    expect(repository.listPending(20)).toEqual([]);
    const page = repository.list({ limit: 20 });

    expect(page.comments.map((comment) => comment.id)).toEqual(["comment-1"]);
    expect(page.stats).toEqual({ total: 1, averageRating: 5 });
    expect(page.nextCursor).toBeNull();
    expect(page.comments[0]).not.toHaveProperty("deviceHash");
    expect(page.comments[0]).not.toHaveProperty("ipHash");
  });

  it("paginates with a stable cursor", () => {
    const repository = makeRepository(
      ["comment-1", "comment-2", "comment-3"],
      [
        "2026-07-01T10:00:00.000Z",
        "2026-07-01T10:30:00.000Z",
        "2026-07-01T11:00:00.000Z",
        "2026-07-01T11:30:00.000Z",
        "2026-07-01T12:00:00.000Z",
        "2026-07-01T12:30:00.000Z",
      ],
    );
    for (const content of ["第一条", "第二条", "第三条"]) {
      const submission = repository.create({
        nickname: "测试用户",
        rating: 5,
        content,
        deviceHash: "device",
        ipHash: "ip",
      });
      repository.moderate(submission.id, "APPROVED");
    }

    const firstPage = repository.list({ limit: 2 });
    const secondPage = repository.list({ limit: 2, cursor: firstPage.nextCursor });

    expect(firstPage.comments.map((comment) => comment.id)).toEqual([
      "comment-3",
      "comment-2",
    ]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(secondPage.comments.map((comment) => comment.id)).toEqual(["comment-1"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("soft deletes a comment from public results", () => {
    const repository = makeRepository(
      ["comment-1"],
      ["2026-07-01T10:00:00.000Z", "2026-07-01T11:00:00.000Z"],
    );
    const submission = repository.create({
      nickname: "小林",
      rating: 5,
      content: "需要删除的评论。",
      deviceHash: "device",
      ipHash: "ip",
    });
    repository.moderate(submission.id, "APPROVED");

    expect(repository.softDelete("comment-1")).toBe(true);
    expect(repository.softDelete("missing")).toBe(false);
    expect(repository.list({ limit: 20 }).comments).toEqual([]);
  });

  it("persists comments when the repository is reopened", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "offerlens-comments-"));
    const databasePath = path.join(directory, "comments.sqlite");
    const first = createCommentRepository({
      path: databasePath,
      createId: () => "persistent-comment",
      now: () => "2026-07-01T10:00:00.000Z",
    });
    const submission = first.create({
      nickname: "小林",
      rating: 4,
      content: "持久化评论。",
      deviceHash: "device",
      ipHash: "ip",
    });
    first.moderate(submission.id, "APPROVED");
    first.close();

    const reopened = createCommentRepository({ path: databasePath });
    repositories.push(reopened);

    expect(reopened.list({ limit: 20 }).comments[0]?.content).toBe("持久化评论。");
  });

  it("migrates legacy visible comments to approved without publishing deleted rows", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "offerlens-comments-legacy-"));
    const databasePath = path.join(directory, "comments.sqlite");
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      CREATE TABLE comments (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        rating INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'visible'
          CHECK (status IN ('visible', 'deleted')),
        deleted_at TEXT,
        device_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL
      );
      CREATE INDEX comments_public_order_idx
        ON comments(status, created_at DESC, id DESC);
      INSERT INTO comments VALUES
        ('visible-1', '旧用户', 5, '旧的公开评价', '2026-06-30T10:00:00.000Z',
         'visible', NULL, 'device-a', 'ip-a'),
        ('deleted-1', '旧用户', 1, '已删除内容', '2026-06-30T11:00:00.000Z',
         'deleted', '2026-06-30T12:00:00.000Z', 'device-b', 'ip-b');
    `);
    legacy.close();

    const migrated = createCommentRepository({ path: databasePath });
    repositories.push(migrated);

    expect(migrated.list({ limit: 20 }).comments.map((comment) => comment.id)).toEqual([
      "visible-1",
    ]);
    expect(migrated.list({ limit: 20 }).stats).toEqual({
      total: 1,
      averageRating: 5,
    });
  });

  it("serializes a burst of writes without losing comments", () => {
    let id = 0;
    const repository = createCommentRepository({
      path: ":memory:",
      createId: () => `comment-${String(++id).padStart(2, "0")}`,
      now: () => `2026-07-01T10:00:${String(id).padStart(2, "0")}.000Z`,
    });
    repositories.push(repository);

    for (let index = 0; index < 20; index += 1) {
      const submission = repository.create({
        nickname: "测试用户",
        rating: 5,
        content: `评论 ${index + 1}`,
        deviceHash: `device-${index}`,
        ipHash: `ip-${index}`,
      });
      repository.moderate(submission.id, "APPROVED");
    }

    expect(repository.list({ limit: 20 }).stats.total).toBe(20);
  });
});

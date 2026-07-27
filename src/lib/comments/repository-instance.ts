import path from "node:path";

import {
  createCommentRepository,
  type CommentRepository,
} from "./repository";

let repository: CommentRepository | null = null;

function defaultDatabasePath(): string {
  if (process.env.COMMENT_DB_PATH) {
    return process.env.COMMENT_DB_PATH;
  }
  if (process.env.NODE_ENV === "production") {
    return "/var/lib/offerlens/comments.sqlite";
  }
  return path.join(process.cwd(), ".data", "comments.sqlite");
}

export function getCommentRepository(): CommentRepository {
  repository ??= createCommentRepository({ path: defaultDatabasePath() });
  return repository;
}

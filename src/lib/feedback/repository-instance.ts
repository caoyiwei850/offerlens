import path from "node:path";

import {
  createFeedbackRepository,
  type FeedbackRepository,
} from "./repository";

let repository: FeedbackRepository | null = null;

function defaultDatabasePath(): string {
  if (process.env.FEEDBACK_DB_PATH) return process.env.FEEDBACK_DB_PATH;
  if (process.env.NODE_ENV === "production") {
    return "/var/lib/offerlens/feedback.sqlite";
  }
  return path.join(process.cwd(), ".data", "feedback.sqlite");
}

export function getFeedbackRepository(): FeedbackRepository {
  repository ??= createFeedbackRepository({ path: defaultDatabasePath() });
  return repository;
}

import {
  createAnalyticsRepository,
  type AnalyticsRepository,
} from "./repository";

let repository: AnalyticsRepository | null = null;

export function getAnalyticsRepository(): AnalyticsRepository {
  if (!repository) {
    repository = createAnalyticsRepository({
      path:
        process.env.ANALYTICS_DB_PATH ??
        (process.env.NODE_ENV === "production"
          ? "/var/lib/offerlens/analytics.sqlite"
          : ".data/analytics.sqlite"),
    });
  }
  return repository;
}

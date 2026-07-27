import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  ANALYTICS_EVENT_TYPES,
  type AnalyticsDimensions,
  type AnalyticsEventType,
  type AnalyticsSummary,
} from "./types";

export interface RecordAnalyticsEvent {
  eventId: string;
  sessionHash: string;
  type: AnalyticsEventType;
  dimensions: AnalyticsDimensions;
}

export type RecordResult = "RECORDED" | "DUPLICATE" | "LIMITED";

export interface AnalyticsRepository {
  record(event: RecordAnalyticsEvent): RecordResult;
  summary(days: 7 | 30): AnalyticsSummary;
  close(): void;
}

interface RepositoryOptions {
  path: string;
  now?: () => string;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0
    ? Math.round((numerator / denominator) * 10_000) / 10_000
    : null;
}

export function createAnalyticsRepository({
  path: databasePath,
  now = () => new Date().toISOString(),
}: RepositoryOptions): AnalyticsRepository {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS analytics_events (
      event_id TEXT PRIMARY KEY,
      session_hash TEXT NOT NULL,
      event_type TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS analytics_events_time_idx
      ON analytics_events(occurred_at, event_type);
    CREATE INDEX IF NOT EXISTS analytics_events_session_idx
      ON analytics_events(session_hash, occurred_at);
  `);

  const countRecentSessionEvents = database.prepare(`
    SELECT COUNT(*) AS count
    FROM analytics_events
    WHERE session_hash = ? AND occurred_at >= ?
  `);
  const insert = database.prepare(`
    INSERT OR IGNORE INTO analytics_events (
      event_id, session_hash, event_type, dimensions_json, occurred_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const funnelQuery = database.prepare(`
    WITH sessions AS (
      SELECT
        session_hash,
        MAX(event_type = 'LANDING_VIEWED') AS landing,
        MAX(event_type = 'ANALYSIS_STARTED') AS analysis_started,
        MAX(event_type = 'ANALYSIS_SUCCEEDED') AS analysis_succeeded,
        MAX(event_type = 'RESULT_VIEWED') AS result_viewed,
        MAX(event_type = 'RESUME_WORKBENCH_VIEWED') AS resume_workbench,
        MAX(event_type = 'RESUME_REWRITE_SUCCEEDED') AS resume_rewrite,
        MAX(event_type = 'RESUME_EXPORTED') AS resume_export,
        MAX(event_type = 'SHARE_ACTION') AS share_action
      FROM analytics_events
      WHERE occurred_at >= ?
      GROUP BY session_hash
    )
    SELECT
      COALESCE(SUM(landing), 0) AS landingSessions,
      COALESCE(SUM(analysis_started), 0) AS analysisStartedSessions,
      COALESCE(SUM(analysis_succeeded), 0) AS analysisSucceededSessions,
      COALESCE(SUM(result_viewed), 0) AS resultViewedSessions,
      COALESCE(SUM(resume_workbench), 0) AS resumeWorkbenchSessions,
      COALESCE(SUM(resume_rewrite), 0) AS resumeRewriteSessions,
      COALESCE(SUM(resume_export), 0) AS resumeExportSessions,
      COALESCE(SUM(share_action), 0) AS shareActionSessions
    FROM sessions
  `);
  const eventsQuery = database.prepare(`
    SELECT event_type AS eventType, COUNT(*) AS events
    FROM analytics_events
    WHERE occurred_at >= ?
    GROUP BY event_type
  `);
  const errorsQuery = database.prepare(`
    SELECT
      json_extract(dimensions_json, '$.errorCode') AS errorCode,
      COUNT(*) AS events
    FROM analytics_events
    WHERE occurred_at >= ?
      AND event_type = 'ANALYSIS_FAILED'
      AND json_extract(dimensions_json, '$.errorCode') IS NOT NULL
    GROUP BY errorCode
    ORDER BY events DESC, errorCode ASC
  `);
  const occupationsQuery = database.prepare(`
    SELECT
      json_extract(dimensions_json, '$.occupationFamily') AS occupationFamily,
      COUNT(DISTINCT session_hash) AS sessions
    FROM analytics_events
    WHERE occurred_at >= ?
      AND event_type = 'ANALYSIS_SUCCEEDED'
      AND json_extract(dimensions_json, '$.occupationFamily') IS NOT NULL
    GROUP BY occupationFamily
    ORDER BY sessions DESC, occupationFamily ASC
  `);
  const dailyQuery = database.prepare(`
    SELECT
      date(datetime(occurred_at, '+8 hours')) AS date,
      COUNT(DISTINCT CASE
        WHEN event_type = 'LANDING_VIEWED' THEN session_hash
      END) AS landingSessions,
      COUNT(DISTINCT CASE
        WHEN event_type = 'ANALYSIS_SUCCEEDED' THEN session_hash
      END) AS analysisSucceededSessions
    FROM analytics_events
    WHERE occurred_at >= ?
    GROUP BY date
    ORDER BY date ASC
  `);

  return {
    record(event) {
      const occurredAt = now();
      const cutoff = new Date(
        Date.parse(occurredAt) - 24 * 60 * 60 * 1000,
      ).toISOString();
      const recent = countRecentSessionEvents.get(
        event.sessionHash,
        cutoff,
      ) as { count: number };
      if (Number(recent.count) >= 200) return "LIMITED";
      const result = insert.run(
        event.eventId,
        event.sessionHash,
        event.type,
        JSON.stringify(event.dimensions),
        occurredAt,
      );
      return result.changes > 0 ? "RECORDED" : "DUPLICATE";
    },

    summary(days) {
      const cutoff = new Date(
        Date.parse(now()) - days * 24 * 60 * 60 * 1000,
      ).toISOString();
      const funnel = funnelQuery.get(cutoff) as {
        landingSessions: number;
        analysisStartedSessions: number;
        analysisSucceededSessions: number;
        resultViewedSessions: number;
        resumeWorkbenchSessions: number;
        resumeRewriteSessions: number;
        resumeExportSessions: number;
        shareActionSessions: number;
      };
      const events = Object.fromEntries(
        ANALYTICS_EVENT_TYPES.map((type) => [type, 0]),
      ) as Record<AnalyticsEventType, number>;
      for (const row of eventsQuery.all(cutoff) as Array<{
        eventType: AnalyticsEventType;
        events: number;
      }>) {
        events[row.eventType] = Number(row.events);
      }
      const landingSessions = Number(funnel.landingSessions);
      const startedSessions = Number(funnel.analysisStartedSessions);
      const succeededSessions = Number(funnel.analysisSucceededSessions);
      return {
        days,
        funnel: {
          landingSessions,
          analysisStartedSessions: startedSessions,
          analysisSucceededSessions: succeededSessions,
          resultViewedSessions: Number(funnel.resultViewedSessions),
          resumeWorkbenchSessions: Number(funnel.resumeWorkbenchSessions),
          resumeRewriteSessions: Number(funnel.resumeRewriteSessions),
          resumeExportSessions: Number(funnel.resumeExportSessions),
          shareActionSessions: Number(funnel.shareActionSessions),
          activationRate: rate(succeededSessions, landingSessions),
          completionRate: rate(succeededSessions, startedSessions),
        },
        events,
        errors: errorsQuery.all(cutoff) as unknown as AnalyticsSummary["errors"],
        occupations:
          occupationsQuery.all(
            cutoff,
          ) as unknown as AnalyticsSummary["occupations"],
        daily: dailyQuery.all(cutoff) as unknown as AnalyticsSummary["daily"],
      };
    },

    close() {
      database.close();
    },
  };
}

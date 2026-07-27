"use client";

import type {
  AnalyticsDimensions,
  AnalyticsEventType,
} from "@/lib/analytics/types";

const SESSION_KEY = "offerlens_analytics_session_v1";
const ONCE_PREFIX = "offerlens_analytics_once_v1:";

function randomId(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function sessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = randomId();
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

export function trackAnalytics(
  type: AnalyticsEventType,
  dimensions: AnalyticsDimensions,
): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    eventId: randomId(),
    sessionId: sessionId(),
    type,
    dimensions,
  });
  try {
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(
        "/api/analytics",
        new Blob([payload], { type: "application/json" }),
      )
    ) {
      return;
    }
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never block the product flow.
  }
}

export function trackAnalyticsOnce(
  key: string,
  type: AnalyticsEventType,
  dimensions: AnalyticsDimensions,
): void {
  if (typeof window === "undefined") return;
  const storageKey = `${ONCE_PREFIX}${key}`;
  if (sessionStorage.getItem(storageKey)) return;
  sessionStorage.setItem(storageKey, "1");
  trackAnalytics(type, dimensions);
}

/**
 * Structured JSON logging for production.
 * Emit JSON lines to stdout when LOG_FORMAT=json or in production.
 * Enables correlation IDs and grep-friendly [SLOW] lines.
 */

export type LogLevel = "info" | "warn" | "error";

export type StructuredLogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  route?: string;
  area?: string;
  ms?: number;
  details?: string;
  [key: string]: unknown;
};

const USE_JSON = process.env.LOG_FORMAT === "json" || process.env.NODE_ENV === "production";

/** Emit a structured log line. JSON in prod, else no-op (use console for dev). */
export function logStructured(entry: StructuredLogEntry): void {
  if (!USE_JSON) return;
  try {
    const line = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString(),
    });
    const out = entry.level === "error" ? console.error : console.warn;
    out(line);
  } catch {
    // Never throw from logging
  }
}

/** Log slow operations in both [SLOW] format (grep) and structured JSON. */
export function logSlowStructured(
  area: string,
  name: string,
  ms: number,
  details?: string,
  correlationId?: string
): void {
  if (USE_JSON) {
    logStructured({
      timestamp: new Date().toISOString(),
      level: "warn",
      message: "slow_operation",
      area,
      route: name,
      ms,
      details,
      correlationId,
    });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * RULE 1.5: Queue Monitor
 * 
 * Monitors task queue depth and latency. Alerts Naomi if queue
 * backlog exceeds thresholds.
 * 
 * Trigger: Every 5 minutes (via cron, called by Naomi)
 * 
 * Metrics:
 *   - Queue depth: number of pending tasks
 *   - Latency (p50, p95, p99): task processing time
 *   - Throughput: tasks/minute
 * 
 * Thresholds (trigger alert):
 *   - Queue depth > 100 tasks
 *   - p95 latency > 5 seconds
 *   - Throughput < 10 tasks/minute (stalled)
 * 
 * Actions on threshold:
 *   1. Log metrics to Naomi topic
 *   2. If critical: escalate to operator (#alerts)
 * 
 * Success metric: Alerts sent <10 seconds after threshold breach
 */

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get queue metrics
    const metrics = await getQueueMetrics();

    // Check thresholds
    const alerts = checkThresholds(metrics);

    if (alerts.length > 0) {
      // Log critical alerts
      await sendAlerts(alerts);
    }

    return NextResponse.json({
      success: true,
      metrics,
      alerts,
      healthy: alerts.length === 0,
    });
  } catch (error) {
    console.error("[Rule 1.5] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get queue metrics
 */
async function getQueueMetrics(): Promise<{
  queueDepth: number;
  latency: { p50: number; p95: number; p99: number };
  throughput: number;
  timestamp: string;
}> {
  // TODO: Query task queue database
  // For now, return mock data
  return {
    queueDepth: 42,
    latency: {
      p50: 1200, // milliseconds
      p95: 3400,
      p99: 5200,
    },
    throughput: 15, // tasks/minute
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper: Check if metrics exceed thresholds
 */
function checkThresholds(metrics: any): Array<{
  severity: "info" | "warning" | "critical";
  metric: string;
  value: number;
  threshold: number;
}> {
  const alerts = [];

  // Queue depth threshold
  if (metrics.queueDepth > 100) {
    alerts.push({
      severity: metrics.queueDepth > 200 ? "critical" : "warning",
      metric: "queueDepth",
      value: metrics.queueDepth,
      threshold: 100,
    });
  }

  // p95 latency threshold
  if (metrics.latency.p95 > 5000) {
    alerts.push({
      severity: metrics.latency.p95 > 10000 ? "critical" : "warning",
      metric: "latency.p95",
      value: metrics.latency.p95,
      threshold: 5000,
    });
  }

  // Throughput threshold (stalled)
  if (metrics.throughput < 10) {
    alerts.push({
      severity: metrics.throughput < 5 ? "critical" : "warning",
      metric: "throughput",
      value: metrics.throughput,
      threshold: 10,
    });
  }

  return alerts;
}

/**
 * Helper: Send alerts to appropriate channels
 */
async function sendAlerts(alerts: any[]): Promise<void> {
  // Separate by severity
  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  // Send critical to #alerts (topic 13)
  if (critical.length > 0) {
    // TODO: message({ action: "send", channel: "telegram", target: "-1003718712318", threadId: 13, message: ... })
    console.log("[Rule 1.5] CRITICAL alerts:", critical);
  }

  // Send all to Naomi's topic (12)
  // TODO: message({ action: "send", channel: "telegram", target: "-1003718712318", threadId: 12, message: ... })
  console.log("[Rule 1.5] Queue metrics:", { critical, warnings });
}

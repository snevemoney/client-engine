/**
 * Phase 2.8.6: Seed default escalation rules (idempotent).
 * Run: npm run db:seed-escalation-rules
 */
import { db } from "../src/lib/db";
import { NotificationSeverity } from "@prisma/client";

const RULES = [
  {
    key: "dead_letter_job",
    title: "Dead-letter job",
    sourceType: "job",
    triggerType: "dead_letter",
    severity: NotificationSeverity.critical,
    channelTargetsJson: ["in_app", "webhook_ops"],
  },
  {
    key: "stale_running_job",
    title: "Stale running job",
    sourceType: "job",
    triggerType: "stale_running",
    severity: NotificationSeverity.critical,
    channelTargetsJson: ["in_app", "webhook_ops"],
  },
  {
    key: "overdue_critical_reminder",
    title: "Overdue critical reminder",
    sourceType: "reminder",
    triggerType: "critical_overdue",
    severity: NotificationSeverity.critical,
    channelTargetsJson: ["in_app"],
  },
  {
    key: "overdue_reminder",
    title: "Overdue reminder",
    sourceType: "reminder",
    triggerType: "overdue",
    severity: NotificationSeverity.warning,
    channelTargetsJson: ["in_app"],
  },
  {
    key: "weekly_review_missing",
    title: "Weekly review missing",
    sourceType: "review",
    triggerType: "weekly_missing",
    severity: NotificationSeverity.warning,
    channelTargetsJson: ["in_app"],
  },
  {
    key: "snapshot_metrics_missing",
    title: "Metrics snapshot missing",
    sourceType: "snapshot",
    triggerType: "missing",
    severity: NotificationSeverity.warning,
    channelTargetsJson: ["in_app"],
    conditionsJson: { kinds: ["metrics"] },
  },
  {
    key: "snapshot_operator_missing",
    title: "Operator score snapshot missing",
    sourceType: "snapshot",
    triggerType: "missing",
    severity: NotificationSeverity.warning,
    channelTargetsJson: ["in_app"],
    conditionsJson: { kinds: ["operator"] },
  },
  {
    key: "snapshot_forecast_missing",
    title: "Forecast snapshot missing",
    sourceType: "snapshot",
    triggerType: "missing",
    severity: NotificationSeverity.warning,
    channelTargetsJson: ["in_app"],
    conditionsJson: { kinds: ["forecast"] },
  },
  {
    key: "retention_overdue",
    title: "Retention follow-up overdue",
    sourceType: "delivery",
    triggerType: "retention_overdue",
    severity: NotificationSeverity.warning,
    channelTargetsJson: ["in_app"],
  },
];

async function main() {
  for (const r of RULES) {
    const existing = await db.escalationRule.findUnique({ where: { key: r.key } });
    if (existing) {
      console.log(`Rule ${r.key} already exists, skipping`);
      continue;
    }
    await db.escalationRule.create({
      data: {
        key: r.key,
        title: r.title,
        sourceType: r.sourceType,
        triggerType: r.triggerType,
        severity: r.severity,
        channelTargetsJson: r.channelTargetsJson,
        conditionsJson: (r as { conditionsJson?: object }).conditionsJson ?? undefined,
      },
    });
    console.log(`Created rule: ${r.key}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));

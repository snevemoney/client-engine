/**
 * Phase 2.8.4: Handler for run_reminder_rules job.
 */

import { runReminderRules } from "@/lib/reminders/run-rules-service";

export async function handleRunReminderRules(): Promise<object> {
  return runReminderRules();
}

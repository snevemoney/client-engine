/**
 * Phase 2.8.4: Reminder rules run service — shared by route and job handler.
 */

import { db } from "@/lib/db";
import { fetchReminderRuleInput } from "@/lib/reminders/fetch-rule-input";
import { generateReminderCandidates } from "@/lib/reminders/rules";

export type RunReminderRulesResult = {
  created: number;
  skipped: number;
  candidatesGenerated: number;
};

export async function runReminderRules(): Promise<RunReminderRulesResult> {
  const input = await fetchReminderRuleInput();
  const candidates = generateReminderCandidates(input);

  const existing = await db.opsReminder.findMany({
    where: { status: { in: ["open", "snoozed"] } },
    select: { sourceType: true, sourceId: true, kind: true, createdByRule: true },
  });

  const existingKeys = new Set(
    existing.map((e) => {
      if (e.sourceType && e.sourceId) return `${e.sourceType}:${e.sourceId}:${e.kind}`;
      return `global:${e.createdByRule ?? e.kind}`;
    })
  );

  let created = 0;
  let skipped = 0;

  for (const c of candidates) {
    const key = c.sourceType && c.sourceId
      ? `${c.sourceType}:${c.sourceId}:${c.kind}`
      : `global:${c.createdByRule}`;

    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    await db.opsReminder.create({
      data: {
        kind: c.kind,
        title: c.title,
        description: c.description,
        status: "open",
        priority: c.priority,
        dueAt: c.dueAt,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        actionUrl: c.actionUrl,
        suggestedAction: c.suggestedAction,
        createdByRule: c.createdByRule,
      },
    });
    created++;
    existingKeys.add(key);
  }

  return {
    created,
    skipped,
    candidatesGenerated: candidates.length,
  };
}

/**
 * Phase 2.8.4: Automation suggestions generate service — shared by route and job handler.
 */

import { db } from "@/lib/db";
import { fetchReminderRuleInput } from "@/lib/reminders/fetch-rule-input";
import { generateAutomationSuggestions } from "@/lib/automation-suggestions/suggestions";

export type GenerateAutomationSuggestionsResult = {
  created: number;
  skipped: number;
  candidatesGenerated: number;
};

export async function generateAutomationSuggestionsService(): Promise<GenerateAutomationSuggestionsResult> {
  const input = await fetchReminderRuleInput();
  const candidates = generateAutomationSuggestions(input);

  const existing = await db.automationSuggestion.findMany({
    where: { status: "pending" },
    select: { type: true, sourceId: true },
  });

  const existingKeys = new Set(
    existing.map((e) => `${e.type}:${e.sourceId ?? "null"}`)
  );

  let created = 0;
  let skipped = 0;

  for (const c of candidates) {
    const key = `${c.type}:${c.sourceId ?? "null"}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    await db.automationSuggestion.create({
      data: {
        type: c.type,
        title: c.title,
        reason: c.reason,
        status: "pending",
        priority: c.priority,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        payloadJson: c.payloadJson ?? {},
        actionUrl: c.actionUrl,
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

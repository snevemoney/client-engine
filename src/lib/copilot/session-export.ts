/**
 * Phase 5.3: Session export — Markdown summary for weekly review.
 */
type MessageInput = { role: string; contentJson: unknown; sourcesJson?: unknown };
type ActionLogInput = {
  mode: string;
  actionKey: string;
  status: string;
  beforeJson: unknown;
  afterJson: unknown;
  resultJson: unknown;
};

export function exportSessionMarkdown(
  session: { title: string | null; createdAt: Date; status: string },
  messages: MessageInput[],
  actionLogs: ActionLogInput[]
): string {
  const lines: string[] = [];
  lines.push(`# Coach Session`);
  lines.push("");
  lines.push(`**Title:** ${session.title ?? "Untitled"}`);
  lines.push(`**Created:** ${session.createdAt.toISOString()}`);
  lines.push(`**Status:** ${session.status}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## Diagnosis");
  const coachMessages = messages.filter((m) => m.role === "coach");
  for (const m of coachMessages) {
    const content = m.contentJson as { reply?: { diagnosis?: string }; diagnosis?: string };
    const diagnosis = content.reply?.diagnosis ?? content.diagnosis;
    if (diagnosis) {
      lines.push(diagnosis);
      lines.push("");
    }
  }
  if (coachMessages.length === 0) lines.push("_No diagnosis recorded._\n");

  lines.push("## Actions Taken");
  const executed = actionLogs.filter((a) => a.mode === "execute");
  if (executed.length === 0) {
    lines.push("_No actions executed._");
  } else {
    for (const a of executed) {
      const result = a.resultJson as { resultSummary?: string } | null;
      lines.push(`- **${a.actionKey}** (${a.status}): ${result?.resultSummary ?? "—"}`);
      if (a.beforeJson && a.afterJson) {
        const before = a.beforeJson as { score?: string; risk?: string; nba?: string };
        const after = a.afterJson as { score?: string; risk?: string; nba?: string };
        lines.push(`  - Before: ${before.score ?? "—"} | ${before.risk ?? "—"} | ${before.nba ?? "—"}`);
        lines.push(`  - After: ${after.score ?? "—"} | ${after.risk ?? "—"} | ${after.nba ?? "—"}`);
      }
      lines.push("");
    }
  }
  lines.push("");

  lines.push("## Open Risks / NBA");
  lines.push("_See context panel or risk/NBA pages for current state._");
  lines.push("");

  lines.push("## Sources");
  const allSources = coachMessages.flatMap((m) => {
    const src = m.sourcesJson as Array<{ kind?: string; id?: string; route?: string }> | null;
    return src ?? [];
  });
  const unique = Array.from(new Set(allSources.map((s) => JSON.stringify(s))));
  for (const s of unique.slice(0, 20)) {
    const parsed = JSON.parse(s) as { kind?: string; id?: string; route?: string };
    lines.push(`- ${parsed.kind ?? "unknown"}: ${parsed.id ?? parsed.route ?? "—"}`);
  }

  return lines.join("\n");
}

/**
 * Pure proof-line builder: no DB, no hype, no invented metrics.
 * Used by generate.ts and by unit tests.
 */

export type ProofInput = {
  saw: string;
  totalCost: number;
  hasPositioning: boolean;
  hasProposal: boolean;
  reframedSnippet: string | null;
  dealOutcome: string | null;
  buildCompletedAt: Date | null;
  buildStartedAt: Date | null;
  approvedAt: Date | null;
  leadTitle: string;
};

/** Forbidden hype/urgency phrases — proof output must not contain these. */
export const HYPE_PATTERNS = [
  /\bguarantee(s|d)?\b/i,
  /\b100%\b/,
  /\b#1\b/,
  /\bbest\s+(in|solution|tool)\b/i,
  /\blimited\s+time\b/i,
  /\bact\s+now\b/i,
  /\bdon't\s+miss\b/i,
  /\bexclusive\b/i,
];

/**
 * Build proof lines from structured input. No invented metrics; cost only from totalCost.
 * Throws if output would contain hype language.
 */
export function buildProofLines(input: ProofInput): string[] {
  const lines: string[] = [];

  const sawTrim = input.saw.replace(/\s+/g, " ").slice(0, 120);
  lines.push(sawTrim.length === 120 ? `Saw: ${sawTrim}…` : `Saw: ${sawTrim}`);

  if (input.totalCost > 0) {
    lines.push(`Cost: approx $${input.totalCost.toFixed(4)} (pipeline only).`);
  } else {
    lines.push(`Cost: not measured for this run.`);
  }

  if (input.hasPositioning) {
    if (input.reframedSnippet) {
      const snip = input.reframedSnippet.slice(0, 80);
      lines.push(`Changed: reframed to outcome-first — ${snip}${input.reframedSnippet.length > 80 ? "…" : ""}`);
    } else {
      lines.push(`Changed: positioned around their problem, not feature list.`);
    }
  }
  if (input.hasProposal) {
    lines.push(`Simplified: one short proposal, no extra tools.`);
  }
  if (!input.hasPositioning && !input.hasProposal) {
    lines.push(`Changed: (no positioning or proposal yet).`);
  }

  if (input.dealOutcome === "won") {
    lines.push(`Result: deal won.`);
  } else if (input.dealOutcome === "lost") {
    lines.push(`Result: deal closed without win.`);
  } else if (input.buildCompletedAt) {
    lines.push(`Result: build completed.`);
  } else if (input.buildStartedAt) {
    lines.push(`Result: build in progress.`);
  } else if (input.approvedAt) {
    lines.push(`Result: approved, build not started yet.`);
  } else if (input.hasProposal) {
    lines.push(`Result: proposal draft ready.`);
  } else {
    lines.push(`Result: in pipeline.`);
  }

  lines.push(`If you want a small checklist for your own ops: comment CHECKLIST.`);

  const out = lines.join("\n");
  for (const pat of HYPE_PATTERNS) {
    if (pat.test(out)) throw new Error(`Proof output must not contain hype/urgency: ${pat.source}`);
  }
  return lines;
}

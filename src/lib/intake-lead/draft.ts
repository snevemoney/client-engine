/**
 * Phase 1.1: Proposal/outreach draft generation for IntakeLead.
 * Deterministic template fallback when no AI. Safe, axiom-compliant.
 */
import type { IntakeLeadUrgency } from "@prisma/client";

export interface DraftInput {
  title: string;
  company: string | null;
  summary: string;
  urgency: IntakeLeadUrgency;
  score: number | null;
}

export interface DraftResult {
  opener: string;
  problemFraming: string;
  proposedNextStep: string;
  cta: string;
  full: string;
}

export function generateDraft(input: DraftInput): DraftResult {
  const { title, company, summary, urgency, score } = input;
  const co = company && company.trim() ? company.trim() : "your team";
  const urgencyNote =
    urgency === "high"
      ? "Given the urgency you mentioned,"
      : urgency === "medium"
        ? "When you're ready,"
        : "At your convenience,";

  const opener = company
    ? `Hi — I saw your posting for "${title}" at ${company}.`
    : `Hi — I saw your posting for "${title}".`;

  const problemFraming =
    summary && summary.length > 20
      ? `From what you described (${summary.slice(0, 120)}${summary.length > 120 ? "…" : ""}), this sounds like a fit for the kind of operations and tooling work we do — clear problem, defined scope.`
      : `This sounds like a fit for the kind of operations and tooling work we do — we focus on one problem at a time and deliver something you can use.`;

  const proposedNextStep = `${urgencyNote} I'd suggest a short call (15–20 min) to confirm scope and timeline. We can do a light discovery and outline a small first experiment.`;

  const cta =
    "If that works, reply with a time that suits you — or let me know what would be more helpful (e.g. a short written proposal first).";

  const full = [opener, problemFraming, proposedNextStep, cta].join("\n\n");

  return { opener, problemFraming, proposedNextStep, cta, full };
}

/**
 * Phase 2: Delivery project default checklist and milestones.
 */

import type { DeliveryChecklistCategory } from "@prisma/client";

export type ChecklistItemInput = {
  category: DeliveryChecklistCategory;
  label: string;
  isRequired?: boolean;
  sortOrder?: number;
};

export type MilestoneInput = {
  title: string;
  description?: string | null;
  sortOrder?: number;
};

/**
 * Default delivery checklist items (kickoff, build, qa, handoff, proof).
 */
export function buildDefaultDeliveryChecklist(): ChecklistItemInput[] {
  return [
    { category: "kickoff", label: "Kickoff call scheduled", isRequired: true, sortOrder: 10 },
    { category: "kickoff", label: "Scope and timeline confirmed", isRequired: true, sortOrder: 20 },
    { category: "build", label: "First deliverable draft ready", isRequired: true, sortOrder: 30 },
    { category: "build", label: "GitHub/artifact link added", isRequired: true, sortOrder: 40 },
    { category: "qa", label: "Internal QA pass complete", isRequired: true, sortOrder: 50 },
    { category: "qa", label: "Client feedback addressed", isRequired: false, sortOrder: 60 },
    { category: "handoff", label: "Handoff documentation complete", isRequired: true, sortOrder: 70 },
    { category: "handoff", label: "Loom walkthrough recorded", isRequired: false, sortOrder: 80 },
    { category: "proof", label: "Proof candidate created", isRequired: false, sortOrder: 90 },
  ];
}

/**
 * Build default milestones from proposal, or generic if no proposal.
 */
export function buildDefaultMilestonesFromProposal(
  proposal?: { deliverables?: unknown } | null
): MilestoneInput[] {
  if (!proposal?.deliverables) {
    return [
      { title: "Discovery", description: "Scope confirmation and kickoff", sortOrder: 10 },
      { title: "First deliverable", description: "Initial work package", sortOrder: 20 },
      { title: "QA & feedback", description: "Review and revisions", sortOrder: 30 },
      { title: "Final handoff", description: "Delivery complete", sortOrder: 40 },
    ];
  }

  const raw = proposal.deliverables;
  let items: string[] = [];
  if (Array.isArray(raw)) {
    items = raw.filter((x): x is string => typeof x === "string");
  } else if (typeof raw === "object" && raw !== null && "items" in raw) {
    const arr = (raw as { items?: unknown[] }).items;
    if (Array.isArray(arr)) {
      items = arr.filter((x): x is string => typeof x === "string");
    }
  }

  if (items.length === 0) {
    return buildDefaultMilestonesFromProposal(null);
  }

  return items.map((title, i) => ({
    title,
    description: null,
    sortOrder: (i + 1) * 10,
  }));
}

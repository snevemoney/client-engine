/**
 * Map each constraint to a playbook: what to do when this is the bottleneck.
 * Used by chatbot for strategist-style answers.
 */

import type { ConstraintSnapshot } from "./types";

export type ConstraintPlaybook = {
  constraintKey: string;
  label: string;
  actions: string[];
  roiFocus: string;
};

const PLAYBOOKS: Record<string, Omit<ConstraintPlaybook, "constraintKey">> = {
  research_intake: {
    label: "Research / lead intake",
    actions: [
      "Tighten source filters; improve signal quality.",
      "Add or tune RSS/feeds; check RESEARCH_FEED_URL and RESEARCH_LIMIT_PER_RUN.",
      "Review filtered-out patterns; avoid over-filtering.",
    ],
    roiFocus: "More qualified leads without more noise.",
  },
  enrichment: {
    label: "Enrichment",
    actions: [
      "Check pipeline run errors for enrich step; retry failed leads.",
      "Improve enrichment prompt or inputs if quality is low.",
      "Ensure research snapshot exists before enrich.",
    ],
    roiFocus: "Higher quality context for scoring and proposals.",
  },
  scoring: {
    label: "Scoring",
    actions: [
      "Review score step failures; retry leads stuck after enrich.",
      "Tune score threshold (e.g. QUALIFIED_SCORE_MIN) if too strict or loose.",
      "Improve score reason consistency for operator review.",
    ],
    roiFocus: "Better prioritization; fewer false positives/negatives.",
  },
  positioning: {
    label: "Positioning",
    actions: [
      "Check position step errors; ensure positioning brief exists for proposal step.",
      "Improve positioning prompt for your niche and offer.",
      "Retry failed runs; fix gate dependencies.",
    ],
    roiFocus: "Stronger fit and angle in proposals.",
  },
  proposal_generation: {
    label: "Proposal generation",
    actions: [
      "Check propose step errors; ensure positioning brief exists.",
      "Improve proposal prompt and proof/offer clarity.",
      "Queue revisions for weak drafts.",
    ],
    roiFocus: "Higher reply and close rate.",
  },
  proposal_approval: {
    label: "Proposal approval",
    actions: [
      "Review and approve proposals in dashboard; send approved ones.",
      "Reduce backlog by batching review (e.g. end-of-day).",
      "Improve proposal quality so approval is faster.",
    ],
    roiFocus: "Speed from draft to sent; less leakage at approval.",
  },
  build_execution: {
    label: "Build execution",
    actions: [
      "Start build for approved leads; check build step errors.",
      "Standardize delivery checklist so builds complete consistently.",
      "Track build completion and handoff.",
    ],
    roiFocus: "Faster delivery and outcome tracking.",
  },
  delivery_outcomes: {
    label: "Delivery / outcomes",
    actions: [
      "Mark deal outcomes (won/lost) on completed builds.",
      "Add delivery proof and case studies.",
      "Close the loop so conversion and revenue are visible.",
    ],
    roiFocus: "Revenue visibility and learning from wins/losses.",
  },
};

export function getConstraintPlaybook(constraint: ConstraintSnapshot | null): ConstraintPlaybook | null {
  if (!constraint) return null;
  const base = PLAYBOOKS[constraint.constraintKey];
  if (!base) return null;
  return {
    constraintKey: constraint.constraintKey,
    label: base.label,
    actions: base.actions,
    roiFocus: base.roiFocus,
  };
}

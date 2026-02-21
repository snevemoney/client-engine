/**
 * Checklist Engine: reusable checklist artifact tied to the offer
 * "I remove operational chaos without adding new tools."
 * Topics: system cleanup, tool reduction, workflow simplification.
 */

export const CHECKLIST_TITLE = "CHECKLIST";

const CORE_SECTIONS = [
  {
    title: "System cleanup",
    items: [
      "List every tool you use in a normal week.",
      "Mark which ones overlap (same job, two tools).",
      "Pick one owner per job; retire or archive the rest.",
    ],
  },
  {
    title: "Tool reduction",
    items: [
      "For each remaining tool: what would break if it disappeared?",
      "If the answer is 'not much,' schedule a trial without it.",
      "Keep only what pays for itself in time or clarity.",
    ],
  },
  {
    title: "Workflow simplification",
    items: [
      "Map the path from 'inbound' to 'done' for one repeatable process.",
      "Count handoffs and copy-paste steps.",
      "Remove one step or one approval; run it once and see.",
    ],
  },
];

export type ChecklistOptions = {
  keywords?: string[];
  requestSource?: "proof_post" | "manual";
  proofPostArtifactId?: string;
};

/**
 * Generate checklist content. No hype; subtraction-focused.
 */
export function buildChecklistContent(_opts: ChecklistOptions = {}): string {
  const lines: string[] = [
    "# Checklist: remove chaos without adding tools",
    "",
    "Use this to tidy your own ops. No signup, no upsell.",
    "",
  ];

  for (const section of CORE_SECTIONS) {
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const item of section.items) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Quiet client engine — no chasing, no cold DMs.*");
  return lines.join("\n");
}

/**
 * Generate HANDOFF_CHECKLIST.md content for a lead.
 * Pre-delivery, client comms, handoff, and closing sections.
 */

export function generateHandoffChecklist(lead: {
  title: string;
  contactName?: string | null;
  contactEmail?: string | null;
  budget?: string | null;
  timeline?: string | null;
}): string {
  const contact = lead.contactName || lead.contactEmail
    ? [lead.contactName, lead.contactEmail].filter(Boolean).join(" · ")
    : "—";
  const budget = lead.budget || "—";
  const timeline = lead.timeline || "—";

  return `# Handoff Checklist: ${lead.title}

## Pre-delivery
- [ ] Scope doc reviewed and signed off
- [ ] Access credentials gathered (hosting, domain, CMS)
- [ ] Kickoff call scheduled
- [ ] Communication channel confirmed (email, Slack, etc.)

## Client comms
- [ ] Intro email sent
- [ ] Weekly check-in cadence agreed
- [ ] Feedback loop defined (review rounds, approval process)

## Handoff
- [ ] Deliverables complete and tested
- [ ] Documentation updated
- [ ] Training/walkthrough scheduled
- [ ] Support handoff (if applicable)

## Closing
- [ ] Final invoice sent
- [ ] Testimonial/review requested
- [ ] Case study or proof captured (optional)

---
**Contact:** ${contact}
**Budget:** ${budget}
**Timeline:** ${timeline}
`;
}

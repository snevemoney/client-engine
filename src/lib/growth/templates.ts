/**
 * Phase 6.3: Outreach templates (scripts) — deterministic, stored in code.
 * Niche: high-ticket local service businesses with follow-up leakage.
 */
export type OutreachTemplate = {
  key: string;
  subject?: string;
  content: string;
  nextFollowUpDays: number;
};

export const OUTREACH_TEMPLATES: Record<string, OutreachTemplate> = {
  broken_link_fix: {
    key: "broken_link_fix",
    content: `Hi {{name}} — I was looking at {{currentWebPresence}} and noticed a broken link that could be costing you leads. For {{niche}} businesses, every missed click is a missed appointment. Happy to do a quick free audit. No pitch.`,
    nextFollowUpDays: 2,
  },
  google_form_upgrade: {
    key: "google_form_upgrade",
    content: `Hey {{name}} — saw you're using Google Forms for intake. Most {{niche}} businesses lose 40% of form fills because the form doesn't feel professional. I've helped a few upgrade to branded intake forms that actually convert. Worth a look when you have 5 min.`,
    nextFollowUpDays: 3,
  },
  linktree_cleanup: {
    key: "linktree_cleanup",
    content: `{{name}} — your Linktree is doing the job but it's leaving money on the table. For {{niche}} businesses, a proper landing page with booking can 2-3x your conversion. Free 10-min audit if you're curious.`,
    nextFollowUpDays: 2,
  },
  big_audience_no_site: {
    key: "big_audience_no_site",
    content: `{{name}} — {{followers}} followers and no site? Every follower that can't book or buy from you is leaked revenue. I build simple sites for {{niche}} businesses that turn followers into appointments. DM if you want a quick chat.`,
    nextFollowUpDays: 7,
  },
  canva_site_upgrade: {
    key: "canva_site_upgrade",
    content: `Hi {{name}} — Canva sites look nice but don't convert. For {{niche}} businesses, every day without a real booking page is appointments you'll never get back. I can help. No obligation.`,
    nextFollowUpDays: 3,
  },
  calendly_blank_fix: {
    key: "calendly_blank_fix",
    content: `{{name}} — your Calendly link looks blank or broken. For a {{niche}} business, that's like having a locked front door. Quick 5-min call and I'll walk you through the fix.`,
    nextFollowUpDays: 2,
  },
  followup_leakage_audit: {
    key: "followup_leakage_audit",
    content: `{{name}} — quick question: how fast does your team respond to new leads from your website? Most {{niche}} businesses lose 40% of leads to slow follow-up. I built a system that fixes this — website + automated follow-up in under 2 hours. Worth a 10-min call?`,
    nextFollowUpDays: 3,
  },
  proof_driven_intro: {
    key: "proof_driven_intro",
    content: `{{name}} — I helped a {{niche}} business go from losing half their leads to booking 90% within 2 hours. The secret was a simple website + follow-up system. No complex tech, no big budget. Want to see how it could work for you? No obligation.`,
    nextFollowUpDays: 5,
  },
};

export const TEMPLATE_KEYS = Object.keys(OUTREACH_TEMPLATES);

export function getTemplate(key: string): OutreachTemplate | null {
  return OUTREACH_TEMPLATES[key] ?? null;
}

export function renderTemplate(
  template: OutreachTemplate,
  vars: Record<string, string | number | undefined>
): string {
  let out = template.content;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, "g"), String(v ?? ""));
  }
  return out;
}

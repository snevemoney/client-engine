/**
 * Phase 6.3: Outreach templates (scripts) — deterministic, stored in code.
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
    content: `Hi {{name}} — noticed a broken link on your {{currentWebPresence}}. Quick fix: happy to audit and suggest a fix. No pitch, just helpful.`,
    nextFollowUpDays: 2,
  },
  google_form_upgrade: {
    key: "google_form_upgrade",
    content: `Hey {{name}} — saw you're using Google Forms for {{niche}}. If you ever want a cleaner branded form or landing page, I've helped a few folks upgrade. Worth a look when you have 5 min.`,
    nextFollowUpDays: 3,
  },
  linktree_cleanup: {
    key: "linktree_cleanup",
    content: `{{name}} — your Linktree could convert better. I've done quick audits for creators in {{niche}}. Free 10-min look if you're curious.`,
    nextFollowUpDays: 2,
  },
  big_audience_no_site: {
    key: "big_audience_no_site",
    content: `{{name}} — {{followers}} followers and no site? You're leaving money on the table. I build simple sites for creators. DM if you want a quick chat.`,
    nextFollowUpDays: 7,
  },
  canva_site_upgrade: {
    key: "canva_site_upgrade",
    content: `Hi {{name}} — Canva sites look nice but don't convert. If you want a real site that books calls or sells, I can help. No obligation.`,
    nextFollowUpDays: 3,
  },
  calendly_blank_fix: {
    key: "calendly_blank_fix",
    content: `{{name}} — your Calendly link looks blank. Common fix. Quick 5-min call and I'll walk you through it.`,
    nextFollowUpDays: 2,
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

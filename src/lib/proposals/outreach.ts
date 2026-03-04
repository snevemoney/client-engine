/**
 * Channel-aware outreach: section header, label, char limit for proposal console.
 * Used by buildProposalPrompt, sections.ts, and ProposalConsoleEditor.
 */

export type OutreachChannel = "upwork" | "email" | "prospect" | "default";

export function getOutreachChannel(source: string | null | undefined): OutreachChannel {
  const s = (source ?? "").toLowerCase();
  if (s === "upwork") return "upwork";
  if (s === "email" || s === "imap") return "email";
  if (s === "prospect" || s === "research" || s === "rss") return "prospect";
  return "default";
}

/** Markdown header for the outreach section in generated proposals. */
export function getOutreachHeader(source: string | null | undefined): string {
  switch (getOutreachChannel(source)) {
    case "upwork":
      return "## Upwork Snippet";
    case "email":
      return "## Email Intro";
    case "prospect":
      return "## Outreach Message";
    default:
      return "## Pitch";
  }
}

/** Human-readable label for the proposal console UI. */
export function getOutreachLabel(source: string | null | undefined): string {
  switch (getOutreachChannel(source)) {
    case "upwork":
      return "Upwork Snippet";
    case "email":
      return "Email Intro";
    case "prospect":
      return "Outreach Message";
    default:
      return "Short Pitch";
  }
}

/** Character limit for the outreach section. */
export function getOutreachCharLimit(source: string | null | undefined): number {
  switch (getOutreachChannel(source)) {
    case "upwork":
      return 600;
    case "email":
    case "prospect":
      return 800;
    default:
      return 600;
  }
}

/** Prompt section text for buildProposalPrompt — tells the LLM what to generate. */
export function getOutreachSectionPrompt(source: string | null | undefined): string {
  const header = getOutreachHeader(source);
  const limit = getOutreachCharLimit(source);
  switch (getOutreachChannel(source)) {
    case "upwork":
      return `${header}\nA standalone 3-4 sentence version suitable for an Upwork proposal cover letter (under ${limit} characters).`;
    case "email":
      return `${header}\nA short email intro: subject line + 2-3 sentence body. Personalized, outcome-focused. Under ${limit} characters total.`;
    case "prospect":
      return `${header}\nA personalized outreach message for this prospect (LinkedIn DM, cold email, etc.). 2-4 sentences, under ${limit} characters.`;
    default:
      return `${header}\nA standalone 3-4 sentence pitch suitable for pasting into any channel (under ${limit} characters).`;
  }
}

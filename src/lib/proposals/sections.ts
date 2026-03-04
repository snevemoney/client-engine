/**
 * Parse and rebuild proposal markdown for the console (Opening, Outreach Snippet, Questions).
 * Supports multiple outreach headers: Upwork Snippet, Email Intro, Outreach Message, Pitch.
 */

import { getOutreachHeader } from "./outreach";

export type ProposalSections = {
  opening: string;
  upworkSnippet: string;
  questions: string;
};

const OPENING_HEADER = "## Opening";
const QUESTIONS_HEADER = "## Questions Before Starting";
const QUESTIONS_HEADER_SHORT = "## Questions";

/** All known outreach headers (for parsing). First match wins. */
const OUTREACH_HEADERS = [
  "## Upwork Snippet",
  "## Email Intro",
  "## Outreach Message",
  "## Pitch",
];

/** Default char limit (Upwork). Use getOutreachCharLimit(source) for channel-aware limit. */
export const UPWORK_SNIPPET_MAX = 600;

function normalizeLineEndings(text: string): string {
  return (text || "").replace(/\r\n/g, "\n");
}

function extractSection(text: string, header: string, nextHeader: string | null): string {
  const start = text.indexOf(header);
  if (start === -1) return "";
  const from = start + header.length;
  const end = nextHeader ? text.indexOf(nextHeader, from) : text.length;
  return text.slice(from, end).trim();
}

/** Extract outreach content from any known header. First match wins. */
function extractOutreachSnippet(text: string): string {
  for (const header of OUTREACH_HEADERS) {
    const content = extractSection(text, header, null);
    if (content) return content;
  }
  return "";
}

/** Find the index of the first outreach header in text, or -1. */
function indexOfFirstOutreachHeader(text: string): number {
  let minIdx = -1;
  for (const header of OUTREACH_HEADERS) {
    const idx = text.indexOf(header);
    if (idx !== -1 && (minIdx === -1 || idx < minIdx)) minIdx = idx;
  }
  return minIdx;
}

/** Extract questions: from header until first outreach header (or end). */
function extractQuestionsSection(text: string, header: string): string {
  const start = text.indexOf(header);
  if (start === -1) return "";
  const from = start + header.length;
  const outreachIdx = indexOfFirstOutreachHeader(text);
  const end = outreachIdx !== -1 && outreachIdx > from ? outreachIdx : text.length;
  return text.slice(from, end).trim();
}

/** Parse full proposal content into the three console sections. */
export function parseProposalSections(content: string, _leadSource?: string | null): ProposalSections {
  const text = normalizeLineEndings(content);

  const opening = extractSection(text, OPENING_HEADER, "## Approach");
  const upworkSnippet = extractOutreachSnippet(text);
  const questionsBefore = extractQuestionsSection(text, QUESTIONS_HEADER);
  const questionsShort = extractQuestionsSection(text, QUESTIONS_HEADER_SHORT);
  const questions = questionsBefore || questionsShort;

  if (!opening && !upworkSnippet && !questions) {
    return {
      opening: text.trim(),
      upworkSnippet: "",
      questions: "",
    };
  }

  return {
    opening: opening.trim(),
    upworkSnippet: upworkSnippet.trim(),
    questions: questions.trim(),
  };
}

/** Rebuild markdown from the three sections (for saving). Uses channel-aware outreach header when source provided. */
export function buildProposalContentFromSections(
  sections: ProposalSections,
  leadSource?: string | null
): string {
  const opening = sections.opening.trim();
  const upwork = sections.upworkSnippet.trim();
  const questions = sections.questions.trim();
  const outreachHeader = leadSource ? getOutreachHeader(leadSource) : "## Upwork Snippet";

  return [
    OPENING_HEADER,
    opening || "_(empty)_",
    "",
    outreachHeader,
    upwork || "_(empty)_",
    "",
    QUESTIONS_HEADER,
    questions || "_(empty)_",
    "",
  ].join("\n");
}

/** Character count for Upwork snippet (trimmed). Use for 600-char limit and meta.snippetCharCount. */
export function getSnippetCharCount(snippet: string): number {
  return (snippet ?? "").trim().length;
}

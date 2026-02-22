/**
 * Parse proposal markdown into sections for the proposal console.
 * Sections: Opening, Upwork Snippet, Questions Before Starting.
 */

export type ProposalSections = {
  opening: string;
  upworkSnippet: string;
  questions: string;
  full: string;
};

const SECTION_HEADERS = [
  "## Opening",
  "## Upwork Snippet",
  "## Questions Before Starting",
] as const;

function extractSection(content: string, header: string, nextHeader: string | null): string {
  const start = content.indexOf(header);
  if (start === -1) return "";
  const from = start + header.length;
  const end = nextHeader ? content.indexOf(nextHeader, from) : content.length;
  return content.slice(from, end).trim();
}

export function parseProposalSections(content: string): ProposalSections {
  const normalized = content.replace(/\r\n/g, "\n");
  return {
    opening: extractSection(
      normalized,
      "## Opening",
      "## Approach"
    ),
    upworkSnippet: extractSection(
      normalized,
      "## Upwork Snippet",
      null
    ),
    questions: extractSection(
      normalized,
      "## Questions Before Starting",
      "## Upwork Snippet"
    ),
    full: content,
  };
}

export const UPWORK_SNIPPET_MAX = 600;

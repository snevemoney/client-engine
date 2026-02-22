/**
 * Parse and rebuild proposal markdown for the console (Opening, Upwork Snippet, Questions).
 * Matches headers from buildProposalPrompt: ## Opening, ## Upwork Snippet, ## Questions Before Starting.
 */

export type ProposalSections = {
  opening: string;
  upworkSnippet: string;
  questions: string;
};

const OPENING_HEADER = "## Opening";
const UPWORK_HEADER = "## Upwork Snippet";
const QUESTIONS_HEADER = "## Questions Before Starting";
const QUESTIONS_HEADER_SHORT = "## Questions";

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

/** Parse full proposal content into the three console sections. */
export function parseProposalSections(content: string): ProposalSections {
  const text = normalizeLineEndings(content);

  const opening = extractSection(text, OPENING_HEADER, "## Approach");
  const upworkSnippet = extractSection(text, UPWORK_HEADER, null);
  const questionsBefore = extractSection(text, QUESTIONS_HEADER, UPWORK_HEADER);
  const questionsShort = extractSection(text, QUESTIONS_HEADER_SHORT, UPWORK_HEADER);
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

/** Rebuild markdown from the three sections (for saving). Uses same headers as pipeline output. */
export function buildProposalContentFromSections(sections: ProposalSections): string {
  const opening = sections.opening.trim();
  const upwork = sections.upworkSnippet.trim();
  const questions = sections.questions.trim();

  return [
    OPENING_HEADER,
    opening || "_(empty)_",
    "",
    UPWORK_HEADER,
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

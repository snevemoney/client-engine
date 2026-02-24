/**
 * Keyword scoring rules for signal items (V1).
 * Match keywords in title + summary; score 0–100; tag matched keywords.
 */

export const SIGNAL_KEYWORDS: { keyword: string; weight: number }[] = [
  { keyword: "hiring", weight: 15 },
  { keyword: "budget", weight: 12 },
  { keyword: "ads", weight: 10 },
  { keyword: "marketing", weight: 10 },
  { keyword: "automation", weight: 12 },
  { keyword: "ai", weight: 10 },
  { keyword: "lead", weight: 8 },
  { keyword: "sales", weight: 8 },
  { keyword: "growth", weight: 6 },
  { keyword: "saas", weight: 8 },
  { keyword: "startup", weight: 5 },
  { keyword: "revenue", weight: 10 },
  { keyword: "integration", weight: 6 },
  { keyword: "api", weight: 5 },
  { keyword: "newsletter", weight: 6 },
  { keyword: "content", weight: 4 },
  { keyword: "conversion", weight: 8 },
];

export function scoreSignalItem(title: string, summary: string | null): { score: number; tags: string[] } {
  const text = `${(title || "").toLowerCase()} ${(summary || "").toLowerCase()}`;
  let total = 0;
  const tags: string[] = [];

  for (const { keyword, weight } of SIGNAL_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      total += weight;
      if (!tags.includes(keyword)) tags.push(keyword);
    }
  }

  const score = Math.min(100, total);
  return { score, tags };
}

/**
 * Low-signal filter: skip intern/unpaid/spam so we don't create junk leads.
 */
const SKIP_PATTERNS = [
  /\bintern\b/i,
  /\bunpaid\b/i,
  /\bvolunteer\b/i,
  /\bequity\s+only\b/i,
  /\bno\s+pay\b/i,
  /\bexposure\s+only\b/i,
];

export function shouldSkipLowSignal(title: string, description: string): boolean {
  const text = `${title} ${description}`;
  return SKIP_PATTERNS.some((re) => re.test(text));
}

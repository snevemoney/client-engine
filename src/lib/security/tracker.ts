/**
 * In-memory burst detector for security events.
 * Tracks event counts per key within a time window and fires once when threshold is crossed.
 */

type TrackerEntry = { count: number; resetAt: number; notified: boolean };

const trackers = new Map<string, TrackerEntry>();
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 500;

function maybeCleanup() {
  cleanupCounter++;
  if (cleanupCounter < CLEANUP_INTERVAL) return;
  cleanupCounter = 0;
  const now = Date.now();
  for (const [key, entry] of trackers) {
    if (now >= entry.resetAt) trackers.delete(key);
  }
}

export function trackSecurityEvent(opts: {
  key: string;
  windowMs: number;
  threshold: number;
}): { shouldNotify: boolean; count: number } {
  maybeCleanup();
  const now = Date.now();
  const entry = trackers.get(opts.key);

  if (!entry || now >= entry.resetAt) {
    trackers.set(opts.key, { count: 1, resetAt: now + opts.windowMs, notified: false });
    return { shouldNotify: false, count: 1 };
  }

  entry.count++;

  if (entry.count >= opts.threshold && !entry.notified) {
    entry.notified = true;
    return { shouldNotify: true, count: entry.count };
  }

  return { shouldNotify: false, count: entry.count };
}

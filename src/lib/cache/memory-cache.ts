/**
 * Phase 2.8.2: In-memory TTL cache for server runtime.
 * Lazy expiry. Optional factory dedupe for concurrent requests.
 */

type Entry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Get value if present and not expired. Returns undefined otherwise.
 */
export function get<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Set value with TTL in milliseconds.
 */
export function set<T>(key: string, value: T, ttlMs: number): void {
  const expiresAt = Date.now() + Math.max(0, ttlMs);
  store.set(key, { value, expiresAt });
}

/**
 * Delete key.
 */
export function del(key: string): void {
  store.delete(key);
}

/**
 * Clear all entries.
 */
export function clear(): void {
  store.clear();
  inFlight.clear();
}

/**
 * Get or set. If key is missing or expired, calls factory and caches result.
 * Dedupes concurrent requests for same key (awaits same promise).
 */
export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>
): Promise<T> {
  const existing = get<T>(key);
  if (existing !== undefined) return existing;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = factory().then((v) => {
    set(key, v, ttlMs);
    inFlight.delete(key);
    return v;
  });
  inFlight.set(key, promise);
  return promise;
}

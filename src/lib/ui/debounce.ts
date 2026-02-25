/**
 * Phase 2.6: Generic debounce utility.
 */

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId != null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delayMs);
  };
}

export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let last = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - last;
    if (elapsed >= limitMs) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      last = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        last = Date.now();
        fn(...args);
      }, limitMs - elapsed);
    }
  };
}

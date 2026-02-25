/**
 * Phase 2.6: Convert unknown errors to user-friendly string.
 */

export function toErrorMessage(e: unknown): string {
  if (e == null) return "An error occurred";
  if (typeof e === "string") return e;
  if (e instanceof Error) {
    if (e.message && !e.message.includes(" at ") && !e.stack) return e.message;
    return e.message || "An error occurred";
  }
  return "An error occurred";
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.message?.toLowerCase().includes("abort"));
}

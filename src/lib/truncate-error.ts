/** Default max length for error messages in logs/DB. */
export const ERROR_MESSAGE_MAX_LENGTH = 2000;

/**
 * Truncate error message for safe storage (logs, DB, API responses).
 * Use instead of ad-hoc .slice(0, N) on error strings.
 */
export function truncateError(msg: string, max = ERROR_MESSAGE_MAX_LENGTH): string {
  if (msg.length <= max) return msg;
  return msg.slice(0, max) + "…";
}

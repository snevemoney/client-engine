/**
 * Next.js instrumentation — runs once when server starts.
 * Validates required env vars before handling requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env-validate");
    validateEnv();
  }
}

/**
 * Environment variable validation at startup.
 * Fail fast with clear message if required vars are missing.
 * Call from instrumentation.ts on server init.
 */
const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "NEXTAUTH_URL"] as const;

export function validateEnv(): void {
  const missing: string[] = [];
  for (const key of REQUIRED) {
    const val = process.env[key];
    if (!val || (typeof val === "string" && val.trim() === "")) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}. ` +
        `Set them in .env or .env.local. See .env.example for reference.`
    );
  }
}

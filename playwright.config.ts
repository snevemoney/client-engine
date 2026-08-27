import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, ".env") });

if (process.env.CI) {
  for (const name of ["AGENT_CRON_SECRET", "RESEARCH_CRON_SECRET"] as const) {
    if (!process.env[name]?.trim()) {
      throw new Error(`${name} must be set in CI (no hardcoded Playwright fallback)`);
    }
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const projectRoot = path.resolve(__dirname);

const webServerEnv: Record<string, string> = {
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>,
  OAUTH_SIMULATION: process.env.OAUTH_SIMULATION || "1",
  E2E_TEST_MODE: "1",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "list",
  globalSetup: path.resolve(__dirname, "tests/e2e/global-setup.ts"),
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  timeout: 45_000,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    baseURL.startsWith("http://localhost") && !process.env.USE_EXISTING_SERVER
      ? {
          command: "npm run dev",
          url: `${baseURL.replace(/\/$/, "")}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          cwd: projectRoot,
          env: webServerEnv,
        }
      : undefined,
});

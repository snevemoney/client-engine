import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, ".env") });

const e2eCronSecret = "e2e-cron-secret-for-playwright";
if (!process.env.RESEARCH_CRON_SECRET) process.env.RESEARCH_CRON_SECRET = e2eCronSecret;
if (!process.env.AGENT_CRON_SECRET) process.env.AGENT_CRON_SECRET = e2eCronSecret;

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const projectRoot = path.resolve(__dirname);

const webServerEnv: Record<string, string> = {
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>,
  AUTH_DEV_PASSWORD: process.env.AUTH_DEV_PASSWORD || "changeme",
  AGENT_CRON_SECRET: process.env.AGENT_CRON_SECRET || e2eCronSecret,
  RESEARCH_CRON_SECRET: process.env.RESEARCH_CRON_SECRET || e2eCronSecret,
  OAUTH_SIMULATION: process.env.OAUTH_SIMULATION || "1",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
          timeout: 90_000,
          cwd: projectRoot,
          env: webServerEnv,
        }
      : undefined,
});

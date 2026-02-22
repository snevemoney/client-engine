import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, ".env") });

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const projectRoot = path.resolve(__dirname);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    baseURL.startsWith("http://localhost") && !process.env.USE_EXISTING_SERVER
      ? {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          cwd: projectRoot,
          env: Object.fromEntries(
            Object.entries(process.env).filter(([, v]) => v !== undefined)
          ) as Record<string, string>,
        }
      : undefined,
});

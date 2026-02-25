/**
 * E2E: OAuth simulation flow.
 * Simulates OAuth (Google) without real credentials. Requires OAUTH_SIMULATION=1 in .env.
 *
 * Run: OAUTH_SIMULATION=1 USE_EXISTING_SERVER=1 npx playwright test tests/e2e/oauth-simulation.spec.ts
 */
import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const email = process.env.ADMIN_EMAIL || process.env.E2E_EMAIL || "admin@evenslouis.ca";
const password = process.env.ADMIN_PASSWORD || process.env.E2E_PASSWORD || "changeme";

test.describe("OAuth simulation", () => {
  test("providers include google-simulation when OAUTH_SIMULATION=1", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/auth/providers`);
    const body = await res.json();
    if (!body["google-simulation"]) {
      test.skip(true, "OAUTH_SIMULATION=1 not set — add to .env to run OAuth simulation tests");
      return;
    }
    expect(body["google-simulation"].name).toContain("Simulate");
  });

  test("Simulate Google flow: click → form → sign in → dashboard", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    const simButton = page.getByTestId("oauth-simulation-button");
    const simForm = page.getByTestId("oauth-simulation-form");

    if (!(await simButton.isVisible())) {
      test.skip(true, "OAUTH_SIMULATION=1 not set — Simulate Google button not visible");
      return;
    }

    await simButton.click();
    await expect(simForm).toBeVisible();

    await page.getByTestId("oauth-sim-email").fill(email);
    await page.getByTestId("oauth-sim-password").fill(password);
    await simForm.getByRole("button", { name: /simulate sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});

import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const email = process.env.ADMIN_EMAIL || process.env.E2E_EMAIL || "admin@evenslouis.ca";
const password = process.env.ADMIN_PASSWORD || process.env.E2E_PASSWORD || "changeme";

test.describe("Lead Copilot", () => {
  test("POST /api/leads/[id]/copilot without auth returns 401", async ({ request }) => {
    const res = await request.post(`${baseURL.replace(/\/$/, "")}/api/leads/cmlvq7e5z0000v5nwmoijvi5z/copilot`, {
      data: { question: "What is the least risky next move?" },
    });
    expect(res.status()).toBe(401);
  });

  test("lead detail page shows Lead Copilot card and Ask Copilot button", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed (wrong credentials or env)");
      return;
    }

    await page.goto("/dashboard/leads");
    await expect(page).toHaveURL(/\/dashboard\/leads/);
    const firstLeadLink = page.locator('a[href^="/dashboard/leads/"]').first();
    await expect(firstLeadLink).toBeVisible({ timeout: 10000 });
    await firstLeadLink.click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9]+/);

    await expect(page.getByText("Lead Copilot", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Ask Copilot/i })).toBeVisible();
  });

  test("Ask Copilot returns structured response with verdict and next move", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed");
      return;
    }

    await page.goto("/dashboard/leads");
    await expect(page).toHaveURL(/\/dashboard\/leads/);
    const firstLeadLink = page.locator('a[href^="/dashboard/leads/"]').first();
    await expect(firstLeadLink).toBeVisible({ timeout: 10000 });
    await firstLeadLink.click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9]+/);

    await expect(page.getByRole("button", { name: /Ask Copilot/i })).toBeVisible();
    await page.getByRole("button", { name: /Ask Copilot/i }).click();

    await expect(page.getByText("Verdict", { exact: false }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Next move", { exact: false }).first()).toBeVisible();
  });
});

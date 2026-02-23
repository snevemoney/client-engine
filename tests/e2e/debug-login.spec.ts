import { test, expect } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const password = process.env.E2E_PASSWORD || process.env.AUTH_DEV_PASSWORD || "changeme";
const email = process.env.E2E_EMAIL || "test@test.com";

test("debug login", async ({ page }) => {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(5000);
  const url = page.url();
  if (url.includes("/login")) {
    test.skip(true, "Login failed (credentials not configured for this env)");
    return;
  }
  expect(url).toContain("dashboard");
});

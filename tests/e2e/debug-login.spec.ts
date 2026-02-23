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
  const bodyText = await page.locator("body").textContent();
  expect(url, `Final URL: ${url}. Body snippet: ${bodyText?.slice(0, 500)}`).toContain("dashboard");
});

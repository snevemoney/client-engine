/**
 * Shared E2E auth helper. Login and wait for stable post-login state.
 */
import { Page, expect } from "@playwright/test";

export const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
export const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
export const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

/**
 * Log in and wait for dashboard. Skips if login fails.
 * @returns true if logged in, false if skipped
 */
export async function loginAndWaitForDashboard(page: Page): Promise<boolean> {
  await page.goto(`${baseURL}/login`, { waitUntil: "load", timeout: 15000 });
  await page.getByLabel("Email").fill(loginEmail);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 12000 });
  if (page.url().includes("/login")) {
    return false;
  }
  // Wait for dashboard shell so session/cookies are stable (sidebar or nav)
  await page.locator('a[href*="/dashboard"]').first().waitFor({ state: "visible", timeout: 8000 });
  return true;
}

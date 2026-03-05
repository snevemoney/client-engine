import { test, expect } from "@playwright/test";
import { loginAndWaitForDashboard } from "./helpers/auth";

test.describe("A/R Panel and Deploys", () => {
  test("Command Center shows A/R Panel with counts", async ({ page }) => {
    test.setTimeout(60000);
    const ok = await loginAndWaitForDashboard(page);
    expect(ok, "Login failed - check E2E credentials").toBe(true);
    await page.goto("/dashboard/command", { waitUntil: "load", timeout: 20000 });
    await expect(page).toHaveURL(/\/dashboard\/command/);
    // A/R Panel card (Section2 streams in via Suspense)
    await expect(page.getByText("A/R Panel")).toBeVisible({ timeout: 30000 });
    // Counts (e.g. "0 unpaid · 0 invoiced" when empty) — use .first() since multiple elements match
    await expect(page.getByText(/unpaid|invoiced/).first()).toBeVisible({ timeout: 10000 });
    // Link to deploys
    await expect(page.getByRole("link", { name: /View Deploys/i })).toBeVisible();
  });

  test("Deploys page has filter tabs and payment column", async ({ page }) => {
    test.setTimeout(60000);
    const ok = await loginAndWaitForDashboard(page);
    expect(ok, "Login failed - check E2E credentials").toBe(true);
    await page.goto("/dashboard/deploys", { waitUntil: "load", timeout: 20000 });
    await expect(page).toHaveURL(/\/dashboard\/deploys/);
    // Filter tabs: All, Unpaid, Invoiced, Paid (exact to avoid "Paid" matching "Unpaid")
    await expect(page.getByRole("link", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Unpaid", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoiced", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Paid", exact: true })).toBeVisible();
    // Payment column header
    await expect(page.getByRole("columnheader", { name: /Payment/i })).toBeVisible();
  });

  test("Deploys page filter=unpaid shows unpaid filter active", async ({ page }) => {
    test.setTimeout(60000);
    const ok = await loginAndWaitForDashboard(page);
    expect(ok, "Login failed - check E2E credentials").toBe(true);
    await page.goto("/dashboard/deploys?filter=unpaid", { waitUntil: "load", timeout: 20000 });
    await expect(page).toHaveURL(/\/dashboard\/deploys\?filter=unpaid/);
    const unpaidLink = page.getByRole("link", { name: "Unpaid", exact: true });
    await expect(unpaidLink).toBeVisible();
    // Unpaid tab should have active styling
    await expect(unpaidLink).toHaveClass(/bg-neutral-200/);
  });
});

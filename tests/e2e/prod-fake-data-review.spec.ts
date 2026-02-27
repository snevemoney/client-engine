/**
 * One-off review: navigate prod and report any fake/test data visible.
 * Run: USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca npx playwright test tests/e2e/prod-fake-data-review.spec.ts
 */
import { test } from "@playwright/test";

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://evenslouis.ca").replace(/\/$/, "");
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

const FAKE_PATTERNS = [
  /E2E test lead/i,
  /E2E Trust-to-close/i,
  /Smoke Test/i,
  /Research Lead 001/i,
  /Mock:/i,
  /Patch Test/i,
  /Test NBA/i,
  /Test Patch Action/i,
  /FLYWHEEL SIMULATION/i,
  // "Learning Engine Runs" and "Research Engine Runs" are legitimate system leads (not fake)
];

function findFakeInText(text: string): string[] {
  return FAKE_PATTERNS.filter((p) => p.test(text)).map((p) => p.source);
}

test.describe("Prod fake data review", () => {
  test("login → leads → command → report fake data", async ({ page }) => {
    await page.goto(`${baseURL}/login`, { waitUntil: "load", timeout: 15000 });
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 12000 });

    const findings: { page: string; patterns: string[] }[] = [];

    // Leads page
    await page.goto(`${baseURL}/dashboard/leads`, { waitUntil: "networkidle", timeout: 15000 });
    const leadsText = await page.locator("body").textContent();
    const leadsFake = findFakeInText(leadsText || "");
    if (leadsFake.length) findings.push({ page: "/dashboard/leads", patterns: leadsFake });

    // Command page
    await page.goto(`${baseURL}/dashboard/command`, { waitUntil: "networkidle", timeout: 15000 });
    const commandText = await page.locator("body").textContent();
    const commandFake = findFakeInText(commandText || "");
    if (commandFake.length) findings.push({ page: "/dashboard/command", patterns: commandFake });

    // Intake page
    await page.goto(`${baseURL}/dashboard/intake`, { waitUntil: "networkidle", timeout: 15000 });
    const intakeText = await page.locator("body").textContent();
    const intakeFake = findFakeInText(intakeText || "");
    if (intakeFake.length) findings.push({ page: "/dashboard/intake", patterns: intakeFake });

    if (findings.length > 0) {
      console.log("\n[PROD FAKE DATA REVIEW] Found test/fake patterns:");
      findings.forEach((f) => console.log(`  ${f.page}: ${f.patterns.join(", ")}`));
      throw new Error(`Fake/test data found on prod: ${JSON.stringify(findings)}`);
    }
    console.log("\n[PROD FAKE DATA REVIEW] No fake/test patterns found. ✓");
  });
});

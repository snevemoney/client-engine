/**
 * Learning ingest: video and channel.
 *
 * Local (dev server + AUTH_DEV_PASSWORD in .env):
 *   USE_EXISTING_SERVER=1 AUTH_DEV_PASSWORD=changeme npm run test:e2e tests/e2e/learning-ingest.spec.ts
 *
 * Prod (login uses hardcoded credentials for evenslouis.ca; ensure server has run reset-auth and has E2E_ALLOW_DEV_PASSWORD=1, AUTH_DEV_PASSWORD=121618louis):
 *   E2E_ALLOW_MUTATIONS=1 USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca npm run test:e2e tests/e2e/learning-ingest.spec.ts
 *   Full ingest test may need 15+ min on prod; use "ingest video then channel" for full run or "prod login and dashboard" for a quick smoke test.
 *
 * Or test manually: Dashboard → Learning, paste video URL → Ingest; then paste channel URL, set Channel → Ingest.
 */
import { test, expect } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const email = (process.env.E2E_EMAIL || "test@test.com").trim().toLowerCase();
const password = (process.env.E2E_PASSWORD || process.env.AUTH_DEV_PASSWORD || "changeme").trim();

test.describe("Learning ingest", () => {
  test.beforeEach(() => {
    requireSafeE2EBaseUrl();
  });

  test("ingest video then channel", async ({ page }) => {
    test.setTimeout(900000); // 15 min for prod (video + channel ingest can be very slow)
    const base = baseURL.replace(/\/$/, "");
    const isProd = base.includes("evenslouis.ca");
    const loginEmail = isProd ? "sneve1@hotmail.com" : email;
    const loginPassword = isProd ? "121618louis" : password;
    await page.goto(`${base}/login`);
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 10000 });
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 20000 });
    if (page.url().includes("/login")) {
      const errText = await page.locator("p.text-red-400").textContent().catch(() => "");
      test.skip(true, `Login failed. Error: ${errText || "none"}. Prod: ensure server has E2E_ALLOW_DEV_PASSWORD=1 and AUTH_DEV_PASSWORD=121618louis, and DB user (run reset-auth).`);
      return;
    }
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`${baseURL}/dashboard/learning`);
    await expect(page).toHaveURL(/\/dashboard\/learning/);

    const urlInput = page.getByTestId("learning-url-input").or(page.getByPlaceholder(/youtube\.com\/watch/));
    const ingestBtn = page.getByTestId("learning-ingest-button").or(page.getByRole("button", { name: /^Ingest$/ }));

    await urlInput.fill("https://www.youtube.com/watch?v=4htG6bk0aEc&t=466s");
    await ingestBtn.click();
    await expect(
      page.locator("p.text-amber-400, p.text-neutral-400").filter({ hasText: /Ingested|error|failed|unavailable|disabled/i })
    ).toBeVisible({ timeout: 120000 });

    const resultEl = page.locator("p.text-amber-400, p.text-neutral-400").filter({ hasText: /Ingested|error|failed|unavailable|disabled/i }).first();
    await expect(resultEl).toBeVisible({ timeout: 5000 });
    const videoResult = await resultEl.textContent();
    expect(videoResult).toBeTruthy();
    const videoOk = !/error|disabled|unavailable|failed/i.test(videoResult ?? "");
    expect(videoOk, `Video ingest should succeed or show clear message. Got: ${videoResult}`).toBe(true);

    await urlInput.fill("https://www.youtube.com/@VALUETAINMENT");
    await expect(ingestBtn).toBeEnabled({ timeout: 30000 });
    await page.locator("select").filter({ has: page.locator('option[value="channel"]') }).selectOption("channel");
    await ingestBtn.click();
    await expect(
      page.locator("p.text-amber-400, p.text-neutral-400").filter({ hasText: /Ingested|error|failed|channel|not configured/i })
    ).toBeVisible({ timeout: 180000 });

    const resultEl2 = page.locator("p.text-amber-400, p.text-neutral-400").filter({ hasText: /Ingested|error|failed|channel|not configured/i }).first();
    await expect(resultEl2).toBeVisible({ timeout: 5000 });
    const channelResult = await resultEl2.textContent();
    expect(channelResult).toBeTruthy();
    const channelOk = !/error|not configured|failed/i.test(channelResult ?? "");
    expect(channelOk, `Channel ingest should succeed or show clear message. Got: ${channelResult}`).toBe(true);
  });
});

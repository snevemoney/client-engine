import { test, expect, Page } from '@playwright/test';

/**
 * Smoke-test every /pro dashboard nav page — no apex /api 404 leaks.
 * Run: PLAYWRIGHT_BASE_URL=https://evenslouis.ca/pro E2E_EMAIL=... E2E_PASSWORD=... pnpm exec playwright test ce-pro-all-pages.spec.ts
 */
const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://evenslouis.ca/pro').replace(/\/$/, '');
const loginEmail = process.env.E2E_EMAIL || process.env.CE_E2E_EMAIL || '';
const loginPassword = process.env.E2E_PASSWORD || process.env.CE_E2E_PASSWORD || '';

const DASHBOARD_PATHS = [
  '/dashboard/intake',
  '/dashboard/prospect',
  '/dashboard/signals',
  '/dashboard/growth',
  '/dashboard/copilot',
  '/dashboard/meta-ads',
  '/dashboard/youtube',
  '/dashboard/leads',
  '/dashboard/decisions',
  '/dashboard/proposals',
  '/dashboard/followups',
  '/dashboard/voice/calls',
  '/dashboard/forecast',
  '/dashboard/delivery',
  '/dashboard/handoffs',
  '/dashboard/build-ops',
  '/dashboard/deploys',
  '/dashboard/proof',
  '/dashboard/scorecard',
  '/dashboard/campaigns',
  '/dashboard/reviews',
  '/dashboard/proof-candidates',
  '/dashboard/content-posts',
  '/dashboard/conversion',
  '/dashboard/retention',
  '/dashboard/risk',
  '/dashboard/intelligence',
  '/dashboard/internal/scoreboard',
  '/dashboard/founder',
  '/dashboard/next-actions',
  '/dashboard/inbox',
  '/dashboard/reminders',
  '/dashboard/founder/os',
  '/dashboard/knowledge',
  '/dashboard/jobs',
  '/dashboard/automation',
  '/dashboard/operator',
  '/dashboard/settings',
  '/dashboard/notifications',
  '/dashboard/notification-channels',
  '/dashboard/flywheel',
  '/dashboard/system',
  '/dashboard/ops-health',
  '/dashboard/job-schedules',
];

const errorPatterns = [
  /API error \(404\)/i,
  /This page could not be found/i,
  /\.next-error-h1/i,
  /Failed to load/i,
];

async function login(page: Page): Promise<boolean> {
  if (!loginEmail || !loginPassword) return false;
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByLabel('Email').fill(loginEmail);
  await page.getByLabel('Password').fill(loginPassword);
  try {
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 25_000 }),
      page.getByRole('button', { name: /sign in/i }).click(),
    ]);
    return !page.url().includes('/login');
  } catch {
    return false;
  }
}

test.describe('Client Engine /pro — all dashboard pages', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await login(page);
    test.skip(!ok, 'Set E2E_EMAIL + E2E_PASSWORD (or CE_E2E_*) for authenticated smoke');
  });

  for (const path of DASHBOARD_PATHS) {
    test(`${path} loads without hard errors`, async ({ page }) => {
      const badApiCalls: string[] = [];
      page.on('request', (req) => {
        const u = req.url();
        if (/evenslouis\.ca\/api\//.test(u) && !u.includes('/pro/api/')) {
          badApiCalls.push(u);
        }
      });

      const response = await page.goto(`${BASE}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
      expect(response?.status(), `${path} HTTP status`).toBeLessThan(400);
      expect(page.url(), `${path} should stay authenticated`).not.toContain('/login');

      await page.waitForTimeout(1200);

      const bodyText = await page.locator('body').innerText();
      for (const pattern of errorPatterns) {
        expect(bodyText, `${path} body should not match ${pattern}`).not.toMatch(pattern);
      }

      expect(badApiCalls, `${path} must not call apex /api`).toEqual([]);
    });
  }
});

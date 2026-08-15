import { test, expect } from '@playwright/test';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://evenslouis.ca/pro').replace(/\/$/, '');

test.describe('Client Engine /pro path deploy', () => {
  test('login page prefixes auth providers API', async ({ page }) => {
    const apiHits: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/')) apiHits.push(req.url());
    });

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30_000 });

    expect(apiHits.some((u) => u.includes('/pro/api/auth/providers'))).toBe(true);
    expect(apiHits.some((u) => u.match(/evenslouis\.ca\/api\/auth/) && !u.includes('/pro/'))).toBe(false);
  });

  test('dashboard redirects unauthenticated users to /pro/login', async ({ page }) => {
    const res = await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    expect(page.url()).toContain('/pro/login');
    expect(page.url()).toContain('callbackUrl=%2Fdashboard');
    expect(res?.status()).toBeLessThan(400);
  });
});

/**
 * Ad-hoc screenshot capture spec — not part of the permanent test suite.
 * Generates docs/screenshots/promptly-results.png and promptly-setup.png.
 *
 * Run with:  npx playwright test e2e/screenshot.spec.ts
 */
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'docs', 'screenshots');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function readFixture<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8')) as T;
}

test.use({ viewport: { width: 1280, height: 800 } });

test('capture setup and results screenshots', async ({ page }) => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // ── mock routes ──────────────────────────────────────────────────────────────

  // GitHub Copilot validate — returns valid with data available.
  // Must include daysAvailable > 0 or explicit availability, otherwise the
  // client falls back to availability='none' and the toggle shows an error.
  await page.route('**/api/sources/github_copilot/validate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ valid: true, sourceId: 'github_copilot', availability: 'full', daysAvailable: 30, warnings: [] }),
    });
  });

  // Analyze — use fixture for a clean, fully-populated hero shot
  const fixture = readFixture<any>('analysis-report.json');
  await page.route('**/api/analyze', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    });
  });

  // ── setup / landing screenshot ─────────────────────────────────────────────

  await page.goto('/');
  await page.waitForSelector('h1', { timeout: 15_000 });
  await page.waitForTimeout(600);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'promptly-setup.png'),
    fullPage: false,
  });

  // ── enable GitHub Copilot source ──────────────────────────────────────────

  // The GitHub Copilot source card is a group element; enable its toggle
  const copilotCard = page.getByRole('group', { name: 'GitHub Copilot', exact: true });
  await copilotCard.waitFor({ state: 'visible', timeout: 10_000 });

  const toggle = copilotCard.getByRole('switch', { name: /GitHub Copilot/i });
  await toggle.click();

  // Wait for the data-availability badge to resolve (either "✅ Data available" or "✓ Validated")
  await copilotCard.locator('[data-testid="source-validation-badge"]').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(300);

  // ── run analysis ──────────────────────────────────────────────────────────

  await page.getByRole('button', { name: 'Run Analysis →' }).click();

  // Wait for results page
  await page.waitForSelector('text=Analysis Results', { timeout: 30_000 });

  // Wait for key results elements to render
  await page.waitForSelector('[data-testid="total-spend"], .text-blue-600, h2', { timeout: 15_000 });
  await page.waitForTimeout(1500);

  // ── results screenshot ────────────────────────────────────────────────────

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'promptly-results.png'),
    fullPage: true,
  });
});

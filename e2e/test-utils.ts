import { expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export function readFixture<T>(name: string): T {
  const fixturePath = path.join(__dirname, 'fixtures', name);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as T;
}

export async function openConnection(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI Token Analytics' })).toBeVisible();
}

export function sourceCard(page: Page, label: string) {
   return page.getByRole('group', { name: label, exact: true });
}

export async function mockValidationRoutes(page: Page) {
  await page.route('**/api/sources/claude_code/validate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(readFixture('claude-code-validate.json')),
    });
  });

  await page.route('**/api/sources/anthropic/validate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(readFixture('anthropic-validate-invalid.json')),
    });
  });

  await page.route('**/api/sources/github_copilot/validate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(readFixture('github-copilot-validate.json')),
    });
  });
}

export async function mockAnalyzeRoute(page: Page, override?: (report: any) => any) {
  await page.route('**/api/analyze', async route => {
    const report = readFixture<any>('analysis-report.json');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(override ? override(report) : report),
    });
  });
}

export async function connectClaudeCode(page: Page) {
  await sourceCard(page, 'Claude Code').getByRole('switch', { name: 'Enable local Claude Code analysis' }).click();
  await expect(sourceCard(page, 'Claude Code').getByText('Validated')).toBeVisible();
}

export async function navigateToMockResults(page: Page) {
  await mockValidationRoutes(page);
  await mockAnalyzeRoute(page);
  await openConnection(page);
  await connectClaudeCode(page);
  await page.getByRole('button', { name: 'Run Analysis →' }).click();
  await expect(page.getByRole('heading', { name: 'Analysis Results' })).toBeVisible();
}

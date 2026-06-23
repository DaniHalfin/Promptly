import { test, expect } from '@playwright/test';
import { connectClaudeCode, mockAnalyzeRoute, mockValidationRoutes, openConnection, sourceCard } from './test-utils';

test.describe('connection flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockValidationRoutes(page);
  });

  test('page loads and shows connection step UI with all four source cards', async ({ page }) => {
    await openConnection(page);

    await expect(page.getByRole('heading', { name: 'Connect Your Sources' })).toBeVisible();
    await expect(sourceCard(page, 'OpenAI')).toBeVisible();
    await expect(sourceCard(page, 'Anthropic')).toBeVisible();
    await expect(sourceCard(page, 'GitHub Copilot')).toBeVisible();
    await expect(sourceCard(page, 'Claude Code')).toBeVisible();
  });

  test('claude_code source card shows enable toggle and no credential field', async ({ page }) => {
    await openConnection(page);

    const card = sourceCard(page, 'Claude Code');
    await expect(card.getByRole('checkbox', { name: 'Enable local Claude Code analysis' })).toBeVisible();
    await expect(card.getByPlaceholder('Paste your API key here')).toHaveCount(0);
    await expect(card.getByText('No API key or file upload is required')).toBeVisible();
  });

  test('anthropic source card shows API key input', async ({ page }) => {
    await openConnection(page);

    const card = sourceCard(page, 'Anthropic');
    await expect(card.getByText('API Key')).toBeVisible();
    await expect(card.getByPlaceholder('Paste your API key here')).toBeVisible();
  });

  test('enabling claude_code with mock validate response shows Connected status', async ({ page }) => {
    await openConnection(page);

    await connectClaudeCode(page);
  });

  test('entering a bad API key for anthropic shows error message from mock', async ({ page }) => {
    await openConnection(page);

    const card = sourceCard(page, 'Anthropic');
    await card.getByPlaceholder('Paste your API key here').fill('bad-api-key');
    await card.getByRole('button', { name: 'Validate' }).click();

    await expect(card.getByText('Invalid API key')).toBeVisible();
  });

  test('allSourcesFailed analyze response returns the UI to the connection step', async ({ page }) => {
    await mockAnalyzeRoute(page, report => ({
      ...report,
      cross_source_summary: {
        ...report.cross_source_summary,
        total_actual_spend_usd: 0,
        total_actual_tokens: 0,
        allSourcesFailed: true,
      },
      sources: report.sources.map((source: any) => ({
        ...source,
        connected: false,
        error: 'Mock source failure',
        metrics: null,
      })),
      recommendations: [],
    }));
    await openConnection(page);
    await connectClaudeCode(page);

    await page.getByRole('button', { name: 'Start Analysis' }).click();

    await expect(page.getByRole('heading', { name: 'Connect Your Sources' })).toBeVisible();
    await expect(sourceCard(page, 'Claude Code')).toBeVisible();
  });
});

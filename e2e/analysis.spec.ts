import { test, expect } from '@playwright/test';
import { navigateToMockResults } from './test-utils';

test.describe('analysis results', () => {
  test('with claude_code connected, clicking Analyze shows results page', async ({ page }) => {
    await navigateToMockResults(page);

    await expect(page.getByRole('heading', { name: 'Analysis Results' })).toBeVisible();
    await expect(page.getByText('$389.80')).toBeVisible();
  });

  test('ClaudeCodePanel renders session count and peak hour metric', async ({ page }) => {
    await navigateToMockResults(page);

    await expect(page.getByRole('heading', { name: 'Claude Code' })).toBeVisible();
    await expect(page.getByText('Sessions', { exact: true })).toBeVisible();
    await expect(page.getByText('42', { exact: true })).toBeVisible();
    await expect(page.getByText('Peak hour sessions')).toBeVisible();
    await expect(page.getByText('64.0%')).toBeVisible();
  });

  test('CopilotPanel renders total cost and model table', async ({ page }) => {
    await navigateToMockResults(page);

    await expect(page.getByRole('heading', { name: 'GitHub Copilot' })).toBeVisible();
    await expect(page.getByText('Total Cost', { exact: true })).toBeVisible();
    await expect(page.getByText('$85.25')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Model spend' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'gpt-5.3-codex' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '$55.41' })).toBeVisible();
  });

  test('OpenAI panel shows estimated disclaimer', async ({ page }) => {
    await navigateToMockResults(page);

    await expect(page.getByRole('heading', { name: 'OpenAI', exact: true })).toBeVisible();
    await expect(page.getByText('Estimated model cost breakdown — exact per-model billing data is not available from the OpenAI API.')).toBeVisible();
    await expect(page.getByText('* Estimated row')).toBeVisible();
  });

  test('Recommendation cards R1 and R2 appear in results', async ({ page }) => {
    await navigateToMockResults(page);

    await expect(page.getByRole('heading', { name: 'Recommendations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Increase prompt caching for Anthropic workloads' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Shift routine claude-opus work to lower-cost models' })).toBeVisible();
  });
});

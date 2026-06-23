import { test, expect } from '@playwright/test';
import { navigateToMockResults } from './test-utils';

test.describe('exports', () => {
  test('PDF export button is present on results page', async ({ page }) => {
    await navigateToMockResults(page);

    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();
  });

  test('JSON export button is present on results page', async ({ page }) => {
    await navigateToMockResults(page);

    await expect(page.getByRole('button', { name: 'Export JSON' })).toBeVisible();
  });

  test('clicking JSON export triggers a download', async ({ page }) => {
    await navigateToMockResults(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^promptly-analysis-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

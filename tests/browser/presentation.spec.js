import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
let base;
test.beforeAll(async () => { base = (await readFile('.cache/browser-url.txt', 'utf8')).trim(); });

test('monthly view includes empty buckets and contextual pagination preserves navigation', async ({ page }) => {
  await page.goto(base);
  await page.getByLabel('Email address').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Sales view')).toHaveValue('daily');
  await page.getByLabel('Sales view').selectOption('monthly');
  await expect(page.getByLabel('Ending month')).toBeVisible();
  await page.getByLabel('Ending month').fill('2025-10');
  await page.getByRole('button', { name: 'Update chart' }).click();
  await expect(page.locator('.panel-head .tag').first()).toContainText('Oct 2025');
  await expect(page.locator('.chart-column')).toHaveCount(6);
  await expect(page.locator('.chart-bar')).toHaveCount(6);
  expect(await page.locator('.chart-bar').evaluateAll(bars => bars.every(bar => bar.style.height === '0px'))).toBe(true);
  for (const [screen, noun] of [['customers', 'customers?'], ['products', 'items?'], ['orders', 'orders?'], ['users', 'team members?'], ['movements', 'stock movements?'], ['audit', 'audit events?']]) {
    await page.locator(`[data-page="${screen}"]`).click();
    await expect(page.locator('.pagination')).toContainText(new RegExp(`\\d+ ${noun} · Page`));
    await expect(page.locator('.pagination')).not.toContainText('records');
    if (screen === 'customers' || screen === 'products') {
      const plural = screen === 'customers' ? 'customers' : 'items';
      const visibility = page.getByLabel(screen === 'customers' ? 'Customer visibility' : 'Item visibility');
      await expect(page.getByLabel(`Sort ${plural}`)).toBeVisible();
      await expect(visibility.locator('option[value="false"]')).toHaveText(`Active ${plural}`);
      await expect(visibility.locator('option[value="true"]')).toHaveText(`Archived ${plural}`);
      await visibility.selectOption('true');
      await Promise.all([
        page.waitForResponse(response => response.url().includes(`/api/${screen}?`) && response.url().includes('archived=true') && response.ok()),
        page.getByRole('button', { name: 'Apply', exact: true }).click()
      ]);
      await expect(page.getByLabel(screen === 'customers' ? 'Customer visibility' : 'Item visibility')).toHaveValue('true');
    }
  }
  await page.locator('[data-page="reports"]').click();
  await page.getByLabel('Report type').selectOption('inventory');
  await page.getByRole('button', { name: 'Run report' }).click();
  await expect(page.locator('.pagination')).toContainText(/\d+ items? · Page/);
});

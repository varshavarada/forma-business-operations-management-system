import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
let base;
test.beforeAll(async () => { base = (await readFile('.cache/browser-url.txt', 'utf8')).trim(); });
test('complete persisted business workflow through the UI', async ({ page }) => {
  await page.goto(base); await page.getByLabel('Email address').fill('administrator@example.test'); await page.getByLabel('Password', { exact: true }).fill('SyntheticPass123!'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
  await page.getByRole('button', { name: 'Customers', exact: false }).first().click(); await page.getByRole('button', { name: '+ Customer', exact: true }).click();
  await page.getByLabel('Customer name').fill('Browser Synthetic Co'); await page.getByLabel('Customer code').fill('BROWSER-001'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('cell', { name: 'Browser Synthetic Co', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Catalog', exact: false }).first().click(); await page.getByRole('button', { name: '+ Catalog item' }).click();
  await page.getByLabel('Item name').fill('Browser Product'); await page.getByLabel('SKU / code').fill('BROWSER-SKU'); await page.getByLabel('Unit price').fill('125.50'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Adjust stock' }).click(); await page.getByLabel('Stock change').fill('10'); await page.getByLabel('Reason', { exact: true }).fill('Synthetic opening'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('cell', { name: '10', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Orders', exact: false }).first().click(); await page.getByRole('button', { name: '+ New order' }).click(); await page.getByLabel('Quantity', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search orders' }).fill('Browser Synthetic Co'); await page.getByRole('button', { name: 'Apply', exact: true }).click(); await expect(page.getByRole('cell', { name: 'Browser Synthetic Co', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click(); page.on('dialog', d => d.accept()); await page.getByRole('button', { name: 'Confirm order', exact: true }).click(); await expect(page.getByRole('button', { name: 'Mark fulfilled' })).toBeVisible();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click(); await page.getByLabel('Amount', { exact: true }).fill('251.00'); await page.getByLabel('Reference / note').fill('Synthetic receipt'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('cell', { name: 'Paid', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click(); await page.getByRole('button', { name: 'Mark fulfilled' }).click(); await expect(page.getByRole('dialog')).toContainText('fulfilled'); await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible(); await expect(page.locator('.metric').first()).toContainText('251.00');
  await page.screenshot({ path: 'docs/evidence/dashboard.png', fullPage: true });
  await page.getByRole('button', { name: 'Reports', exact: false }).first().click(); await expect(page.getByRole('cell', { name: 'Browser Synthetic Co', exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV' }).click(); const download = await downloadPromise; expect(download.suggestedFilename()).toBe('sales-report.csv');
  await page.getByRole('button', { name: 'Activity history', exact: false }).first().click(); await expect(page.getByRole('cell', { name: 'order.fulfilled', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
test('validation feedback preserves input and stored HTML is rendered as text', async ({ page }) => {
  await page.goto(base); await page.getByLabel('Email address').fill('administrator@example.test'); await page.getByLabel('Password', { exact: true }).fill('SyntheticPass123!'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Customers', exact: false }).first().click(); await page.getByRole('button', { name: '+ Customer', exact: true }).click();
  await page.getByLabel('Customer name').fill('Retained input'); await page.getByLabel('Customer code').fill('BROWSER-001'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('alert')).toHaveText('A unique value already exists'); await expect(page.getByLabel('Customer name')).toHaveValue('Retained input');
  const payload = '<img src=x onerror=alert(1)>'; await page.getByLabel('Customer name').fill(payload); await page.getByLabel('Customer code').fill('BROWSER-XSS'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('cell', { name: payload, exact: true })).toBeVisible(); await expect(page.locator('main img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reports', exact: false }).first().click(); await page.getByLabel('Report type').selectOption('inventory'); await page.getByRole('button', { name: 'Run report' }).click(); await expect(page.getByRole('heading', { name: 'Inventory snapshot' })).toBeVisible(); await expect(page.getByRole('cell', { name: '8', exact: true })).toBeVisible();
});
test('payment correction and cancellation restore inventory through the UI', async ({ page }) => {
  await page.goto(base); await page.getByLabel('Email address').fill('manager@example.test'); await page.getByLabel('Password', { exact: true }).fill('SyntheticPass123!'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Orders', exact: false }).first().click(); await page.getByRole('button', { name: '+ New order' }).click(); await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('button', { name: 'Review', exact: true }).first().click(); await page.getByRole('button', { name: 'Confirm order', exact: true }).click(); await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click(); await page.getByLabel('Amount', { exact: true }).fill('25.00'); await page.getByLabel('Reference / note').fill('Synthetic correction case'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Review', exact: true }).first().click(); await page.getByRole('button', { name: 'Reverse', exact: true }).click(); await page.getByLabel('Reason', { exact: true }).fill('Incorrect manual entry'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('cell', { name: 'Unpaid', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).first().click(); await page.getByRole('button', { name: 'Cancel order', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('cancelled'); await page.getByRole('button', { name: 'Close dialog' }).click(); await page.getByRole('button', { name: 'Catalog', exact: false }).first().click(); await expect(page.getByRole('cell', { name: '8', exact: true })).toBeVisible();
});
for (const [name, width, height] of [['mobile', 390, 844], ['tablet', 820, 1180], ['desktop', 1440, 900]]) test(`${name} navigation, keyboard and responsive layout`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await page.goto(base); await page.getByLabel('Email address').fill('staff@example.test'); await page.getByLabel('Password', { exact: true }).fill('SyntheticPass123!'); await page.getByLabel('Password', { exact: true }).press('Enter'); await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  if (width < 700) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('button', { name: 'Reports', exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Customers', exact: false }).first().click(); await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: '+ Customer', exact: true }).click(); await expect(page.getByLabel('Customer name')).toBeFocused(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
});

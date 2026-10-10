import { chromium, expect } from '@playwright/test';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { startProfessionalDemo } from './professional-demo.js';
import { verifyProfessionalDemo } from './professional-verify.js';

const output = 'docs/evidence/professional';
const args = process.argv.slice(2);
if (args.some(arg => !arg.startsWith('--reference-date='))) throw new Error('Usage: npm run demo:capture -- --reference-date=YYYY-MM-DD');
let fixture, browser;
const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => controller.abort());
try {
  fixture = await startProfessionalDemo({ referenceDate: args.find(arg => arg.startsWith('--reference-date='))?.split('=')[1], onProgress: console.log, signal: controller.signal });
  await mkdir(output, { recursive: true });
  let channel = process.env.PLAYWRIGHT_CHANNEL;
  if (!channel && process.platform === 'win32') {
    try { await access('C:/Program Files/Google/Chrome/Application/chrome.exe'); channel = 'chrome'; } catch { /* Use installed Playwright Chromium. */ }
  }
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], screenshots = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(fixture.base);
  await page.getByLabel('Email address').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.sidebar-bottom strong')).toHaveText('Ananya Mehta');
  async function capture(filename, fullPage = true) {
    controller.signal.throwIfAborted();
    assert.deepEqual(errors, []);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${filename}`, fullPage });
    screenshots.push(filename);
  }
  await page.getByLabel('Sales view').selectOption('monthly');
  await expect(page.getByRole('img', { name: 'Monthly confirmed sales' })).toBeVisible();
  await page.getByLabel('Ending month').fill(fixture.plan.referenceDate.slice(0, 7));
  await page.getByRole('button', { name: 'Update chart' }).click();
  await expect(page.locator('.chart-column')).toHaveCount(6);
  await expect(page.locator('.metric').nth(2)).toHaveText('200');
  await capture('figure-1-business-overview.png', false);

  await page.locator('[data-page="customers"]').click();
  await expect(page.locator('.pagination')).toContainText('150 customers');
  await page.getByLabel('Sort customers').selectOption('name');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const firstName = fixture.plan.customers.map(customer => customer.name).sort()[0];
  await expect(page.getByRole('cell', { name: firstName, exact: true })).toBeVisible();
  await capture('figure-2-customers.png');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.pagination')).toContainText('Page 2 of 8');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByLabel('Search by name').fill(fixture.plan.customers[0].name);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.pagination')).toContainText('1 customer');

  await page.locator('[data-page="reports"]').click();
  const start = `${fixture.plan.period.months[0]}-01`, end = fixture.plan.referenceDate;
  await page.getByLabel('From', { exact: true }).fill(start);
  await page.getByLabel('Through', { exact: true }).fill(end);
  await Promise.all([
    page.waitForResponse(response => response.url().includes(`/api/reports?`) && response.url().includes(`start=${start}`) && response.url().includes(`end=${end}`) && response.ok()),
    page.getByRole('button', { name: 'Run report' }).click()
  ]);
  await expect(page.locator('.report-summary strong').last()).toHaveText('200');
  await capture('figure-3-operational-reports.png', false);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloaded; await download.saveAs(`${output}/sales-report.csv`);
  const csv = await readFile(`${output}/sales-report.csv`, 'utf8');
  assert.equal(csv.split('\r\n').length, 201);
  assert.ok(csv.startsWith('"Order","Customer","Date","Status","Total minor units","Paid minor units"'));
  let csvSales = 0, csvPaid = 0;
  const csvOrders = new Set(), customerNames = new Set(fixture.plan.customers.map(customer => customer.name));
  // This scenario has no commas/quotes/newlines in names. Validate its six quoted fields.
  for (const row of csv.split('\r\n').slice(1)) {
    const fields = row.match(/^"([^"\r\n]*)","([^"\r\n]*)","([^"\r\n]*)","([^"\r\n]*)","(\d+)","(\d+)"$/);
    assert.ok(fields, 'Unexpected professional CSV row');
    assert.ok(customerNames.has(fields[2]), 'CSV customer identity must match the demo');
    csvOrders.add(fields[1]); csvSales += Number(fields[5]); csvPaid += Number(fields[6]);
    assert.ok(Number(fields[6]) <= Number(fields[5]));
  }
  assert.equal(csvOrders.size, 200); assert.equal(csvSales, fixture.verification.salesMinorUnits); assert.equal(csvPaid, fixture.verification.paidMinorUnits);

  await page.locator('[data-page="orders"]').click();
  await expect(page.locator('.pagination')).toContainText('200 orders');
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await capture('figure-4-sales-orders.png');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.pagination')).toContainText('Page 2 of 10');

  await page.locator('[data-page="products"]').click();
  await expect(page.locator('.pagination')).toContainText('40 items');
  await page.getByLabel('Sort items').selectOption('name');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('tbody .tag').filter({ hasText: 'service' }).first()).toBeVisible();
  await capture('figure-5-products-services.png');

  // Exercise the same monthly view at narrow width; keep its artifact separate.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.locator('[data-page="dashboard"]').click();
  await expect(page.getByRole('img', { name: 'Monthly confirmed sales' })).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.locator('.metric').evaluateAll(metrics => metrics.every(metric => metric.scrollWidth <= metric.clientWidth)), 'Currency values must fit inside their KPI cards');
  await capture('supplement-monthly-mobile.png');
  const reconciliation = await verifyProfessionalDemo(fixture.plan, fixture.api);
  assert.deepEqual(reconciliation, fixture.verification);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/verification.json`, JSON.stringify({ capturedAt: new Date().toISOString(), browser: await browser.version(), viewport: { width: 1440, height: 1100 }, screenshots, reconciliation, checks: ['UI entity totals and pagination', 'customer sorting and filtering', 'monthly mobile overflow and currency-card fit', '200-row CSV export and financial totals', 'pre/post-capture reconciliation', 'no browser page errors'] }, null, 2));
  console.log(`Captured ${screenshots.length} genuine screenshots and a verified 200-row CSV in ${output}`);
} catch (error) {
  console.error(`Professional capture failed: ${error.message}. See docs/professional-demo.md for reproduction and manual capture instructions.`);
  process.exitCode = 1;
} finally {
  try { if (browser) await browser.close(); } finally { if (fixture) await fixture.close(); }
}

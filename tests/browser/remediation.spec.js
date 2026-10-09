import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
let base;
test.beforeAll(async () => { base = (await readFile('.cache/browser-url.txt', 'utf8')).trim(); });
async function login(page) {
  await page.goto(base);
  await page.getByLabel('Email address').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
}
async function request(page, path, method = 'GET', data) {
  const me = await (await page.request.get(`${base}/api/auth/me`)).json();
  return page.request.fetch(`${base}/api${path}`, { method, data, headers: { Origin: base, 'X-CSRF-Token': me.csrf, 'Idempotency-Key': crypto.randomUUID() } });
}
async function customer(page, suffix) {
  const response = await request(page, '/customers', 'POST', { code: `REG-${suffix}`, name: `ZZ Regression ${suffix}`, email: '', phone: '' });
  expect(response.status()).toBe(201); return response.json();
}
async function product(page, suffix) {
  const response = await request(page, '/products', 'POST', { sku: `REG-${suffix}`, name: `ZZ Regression ${suffix}`, type: 'service', price: 100, reorderLevel: 0 });
  expect(response.status()).toBe(201); return response.json();
}
test('customer conflict reload preserves local edits and latest remote changes', async ({ page }) => {
  await login(page); const c = await customer(page, 'CONFLICT');
  await page.locator('[data-page="customers"]').click();
  await page.getByRole('row').filter({ hasText: c.code }).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Phone (optional)').fill('123456');
  const changed = await request(page, `/customers/${c._id}`, 'PATCH', { code: c.code, name: 'ZZ Remote edit', email: '', phone: '', version: c.version });
  expect(changed.status()).toBe(200);
  const conflict = page.waitForResponse(r => r.url().endsWith(`/customers/${c._id}`) && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); expect((await conflict).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('updated by someone else');
  await page.getByRole('button', { name: 'Reload latest customer' }).click();
  await expect(page.getByLabel('Customer name')).toHaveValue('ZZ Remote edit');
  await expect(page.getByLabel('Phone (optional)')).toHaveValue('123456');
  await expect(page.getByRole('status').filter({ hasText: 'Latest customer loaded' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  const saved = await (await request(page, `/customers/${c._id}`)).json();
  expect(saved.name).toBe('ZZ Remote edit'); expect(saved.phone).toBe('123456'); expect(saved.version).toBe(2);
});
test('catalog type is selectable only during creation and immutable on update', async ({ page }) => {
  await login(page); const p = await product(page, 'TYPE');
  await page.locator('[data-page="products"]').click();
  await page.getByRole('button', { name: '+ Catalog item' }).click();
  await expect(page.getByLabel('Item type')).toHaveJSProperty('tagName', 'SELECT');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('row').filter({ hasText: p.sku }).getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Item type')).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Item type')).toHaveValue('service');
  await page.getByLabel('Item name').fill('ZZ Regression type renamed');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  const tampered = await request(page, `/products/${p._id}`, 'PATCH', { sku: p.sku, name: p.name, type: 'product', price: p.price, reorderLevel: 0 });
  expect(tampered.status()).toBe(409);
});
test('empty orders show accessible feedback and never submit an empty request', async ({ page }) => {
  await login(page); await customer(page, 'EMPTY'); await product(page, 'EMPTY');
  await page.locator('[data-page="orders"]').click(); await page.getByRole('button', { name: '+ New order' }).click();
  let submissions = 0; page.on('request', r => { if (r.url().endsWith('/api/orders') && r.method() === 'POST') submissions++; });
  await page.getByRole('button', { name: 'Remove item' }).click();
  await expect(page.locator('#order-lines-error')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#order-lines-error')).toHaveText('Add at least one item before saving this order.');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.locator('#modal-form').evaluate(form => form.requestSubmit());
  await expect(page.locator('#form-error')).toContainText('Add at least one item');
  expect(submissions).toBe(0);
  await page.getByRole('button', { name: '+ Add item' }).click();
  await expect(page.locator('#order-lines-error')).toBeEmpty();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});
test('mobile drawer dismisses, traps focus and scrolls at 320 by 568', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await login(page);
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  await toggle.click();
  const drawer = page.getByRole('dialog', { name: 'Main navigation' });
  await expect(drawer).toBeVisible(); await expect(drawer.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  expect(await page.locator('.workspace').evaluate(el => el.inert)).toBe(true);
  await page.keyboard.press('Shift+Tab'); await expect(drawer.locator('[data-page="users"]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(drawer.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(drawer).not.toBeVisible(); await expect(toggle).toBeFocused();
  expect(await page.locator('.workspace').evaluate(el => el.inert)).toBe(false);
  await toggle.click(); await page.locator('.nav-backdrop').click({ position: { x: 300, y: 100 } });
  await expect(toggle).toBeFocused(); await expect(page.locator('.sidebar')).not.toBeVisible();
  await toggle.click();
  const metrics = await page.locator('.sidebar').evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight }));
  expect(metrics.height).toBeLessThanOrEqual(568); expect(metrics.content).toBeGreaterThan(metrics.height);
  await drawer.locator('[data-page="users"]').focus();
  await expect(drawer.locator('[data-page="users"]')).toBeInViewport();
  await page.locator('.sidebar-bottom').scrollIntoViewIfNeeded(); await expect(page.locator('.sidebar-bottom')).toBeInViewport();
  await page.keyboard.press('Escape');
  await toggle.click(); await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.locator('.workspace').evaluate(el => el.inert)).toBe(false);
  await expect(page.locator('.sidebar')).not.toHaveAttribute('aria-modal');
});
test('order search remains usable without document overflow at narrow mobile widths', async ({ page }) => {
  await login(page); await page.locator('[data-page="orders"]').click();
  await expect(page.getByRole('heading', { name: 'Sales orders' })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 568 });
    const box = await page.getByRole('searchbox', { name: 'Search orders' }).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(width - 34);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('searchbox', { name: 'Search orders' }).fill('No regression match');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: 'Search orders' })).toHaveValue('No regression match');
  }
});
test('delayed sales report cannot update a removed screen or replace a newer inventory report', async ({ page }) => {
  await login(page); const errors = []; page.on('pageerror', error => errors.push(error.message));
  let release, arrived, settled;
  const held = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { settled = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/reports?*', async route => {
    const response = await route.fetch(); arrived(); await gate;
    try { await route.fulfill({ response }); } catch { /* The browser may already have cancelled this obsolete request. */ }
    settled();
  }, { times: 1 });
  await page.locator('[data-page="reports"]').click(); await held;
  await page.locator('[data-page="customers"]').click();
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  release(); await done; await expect(page.locator('#report-results')).toHaveCount(0);
  let releaseSecond, arrivedSecond, settledSecond;
  const heldSecond = new Promise(resolve => { arrivedSecond = resolve; });
  const doneSecond = new Promise(resolve => { settledSecond = resolve; });
  const gateSecond = new Promise(resolve => { releaseSecond = resolve; });
  await page.route('**/api/reports?*', async route => {
    const response = await route.fetch(); arrivedSecond(); await gateSecond;
    try { await route.fulfill({ response }); } catch { /* Expected cancellation. */ }
    settledSecond();
  }, { times: 1 });
  await page.locator('[data-page="reports"]').click(); await heldSecond;
  await page.getByLabel('Report type').selectOption('inventory');
  await page.getByRole('button', { name: 'Run report' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory snapshot' })).toBeVisible();
  releaseSecond(); await doneSecond;
  await expect(page.getByRole('heading', { name: 'Inventory snapshot' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sales detail' })).toHaveCount(0); expect(errors).toEqual([]);
});
test('delayed inventory report cannot render into a newer report page', async ({ page }) => {
  await login(page); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.locator('[data-page="reports"]').click(); await expect(page.getByRole('heading', { name: 'Sales detail' })).toBeVisible();
  let release, arrived, settled;
  const held = new Promise(resolve => { arrived = resolve; });
  const done = new Promise(resolve => { settled = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/reports/inventory?*', async route => {
    const response = await route.fetch(); arrived(); await gate;
    try { await route.fulfill({ response }); } catch { /* Expected cancellation. */ }
    settled();
  }, { times: 1 });
  await page.getByLabel('Report type').selectOption('inventory'); await page.getByRole('button', { name: 'Run report' }).click(); await held;
  await page.locator('[data-page="customers"]').click(); await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await page.locator('[data-page="reports"]').click(); await expect(page.getByRole('heading', { name: 'Sales detail' })).toBeVisible();
  release(); await done; await expect(page.getByRole('heading', { name: 'Inventory snapshot' })).toHaveCount(0); expect(errors).toEqual([]);
});
test('server-revoked session returns 401 and renders clean login with no uncaught errors', async ({ page }) => {
  await login(page); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const revoked = await request(page, '/auth/logout', 'POST'); expect(revoked.status()).toBe(200);
  const denied = page.waitForResponse(r => r.url().includes('/api/customers?'));
  await page.locator('[data-page="customers"]').click(); expect((await denied).status()).toBe(401);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('#main')).toHaveCount(0); expect(errors).toEqual([]);
  await page.getByLabel('Email address').fill('administrator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible(); expect(errors).toEqual([]);
});
test('expired-session HTTP response during a report renders clean login', async ({ page }) => {
  await login(page); const errors = []; page.on('pageerror', error => errors.push(error.message));
  // Simulates the expiry response; actual database expiry is covered by the backend suite.
  await page.route('**/api/reports?*', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Session expired' }) }), { times: 1 });
  const denied = page.waitForResponse(r => r.url().includes('/api/reports?'));
  await page.locator('[data-page="reports"]').click(); expect((await denied).status()).toBe(401);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible(); await expect(page.locator('#report-results')).toHaveCount(0); expect(errors).toEqual([]);
});

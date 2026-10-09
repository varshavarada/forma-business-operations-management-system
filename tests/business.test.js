import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startFixture, client } from './helpers.js';
import { Product, Order, Movement, Audit, Session, User } from '../server/models.js';
import { fork, spawn } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdir, mkdtemp, copyFile, readFile, unlink, rmdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
let fixture, api, staff;
before(async () => { fixture = await startFixture(); api = await client(fixture.base); staff = await client(fixture.base, 'Staff'); });
after(async () => { if (fixture) await fixture.close(); });
async function customer(code = crypto.randomUUID()) { const r = await api('/customers', 'POST', { code, name: 'Synthetic Customer', email: '', phone: '' }); assert.equal(r.status, 201); return r.body; }
async function product(stock = 10, type = 'product') { const r = await api('/products', 'POST', { sku: crypto.randomUUID(), name: 'Synthetic Item', type, price: 12345, reorderLevel: 3 }); assert.equal(r.status, 201); if (stock && type === 'product') assert.equal((await api(`/products/${r.body._id}/adjust`, 'POST', { delta: stock, reason: 'Synthetic opening stock' })).status, 200); return r.body; }
async function order(c, p, quantity = 1, key) { const r = await api('/orders', 'POST', { customer: c._id, items: [{ product: p._id, quantity }] }, key); assert.equal(r.status, 201); return r.body; }
test('authentication, CSRF, role gates, protected routes and field allowlists', async () => {
  assert.equal((await fetch(`${fixture.base}/api/orders`)).status, 401);
  const invalid = await fetch(`${fixture.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: fixture.base }, body: JSON.stringify({ email: 'staff@example.test', password: 'wrong' }) }); assert.equal(invalid.status, 401);
  assert.equal((await staff('/users')).status, 403);
  assert.equal((await staff('/reports?start=2026-01-01&end=2026-12-31')).status, 403);
  assert.equal((await staff('/products', 'POST', { sku: 'forbidden', name: 'x', type: 'product', price: 1, reorderLevel: 0 })).status, 403);
  assert.equal((await api('/customers', 'POST', { code: 'csrf', name: 'x', email: '', phone: '' }, undefined, { 'X-CSRF-Token': 'bad' })).status, 403);
  assert.equal((await api('/customers', 'POST', { code: 'origin', name: 'x', email: '', phone: '' }, undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await api('/customers', 'POST', { code: 'invalid', name: 'x', email: '', phone: '', role: 'Administrator' })).status, 400);
  assert.equal((await api('/products', 'POST', { sku: 'inject', name: { $ne: null }, type: 'product', price: -1, reorderLevel: 0 })).status, 400);
  assert.equal((await api('/orders/not-an-id')).status, 400);
});
test('customers and catalog: uniqueness, filtering, pagination, service rules and archival', async () => {
  const c = await customer('UNIQUE-CUSTOMER'); assert.equal((await api('/customers', 'POST', { code: 'unique-customer', name: 'Duplicate', email: '', phone: '' })).status, 409);
  assert.equal((await api('/customers?limit=101')).status, 400);
  const found = await api('/customers?q=Synthetic&limit=1&sort=name'); assert.equal(found.body.items.length, 1); assert.ok(found.body.total >= 1);
  assert.equal((await api('/customers?q=%5B')).status, 200);
  assert.equal((await api('/orders?q=%5B')).status, 200);
  assert.equal((await api(`/customers/${c._id}`, 'PATCH', { code: c.code, name: c.name, email: '', phone: '', archived: true, version: c.version })).status, 200);
  const p = await product(0, 'service'); assert.equal((await api(`/products/${p._id}/adjust`, 'POST', { delta: 1, reason: 'not stock' })).status, 409);
  assert.equal((await api('/orders', 'POST', { customer: c._id, items: [{ product: p._id, quantity: 1 }] })).status, 404);
});
test('complete workflow: stock, historical prices, payment tracking, reports and audit', async () => {
  const c = await customer(), p = await product(10), o = await order(c, p, 2);
  assert.equal(o.total, 24690); assert.equal((await Product.findById(p._id)).stock, 10);
  await api(`/products/${p._id}`, 'PATCH', { sku: p.sku, name: p.name, type: p.type, price: 999, reorderLevel: 3 });
  const confirmed = await staff(`/orders/${o._id}/transition`, 'POST', { status: 'confirmed' }); assert.equal(confirmed.status, 200); assert.equal(confirmed.body.total, 24690);
  assert.equal((await Product.findById(p._id)).stock, 8);
  assert.equal((await staff(`/orders/${o._id}/transition`, 'POST', { status: 'fulfilled' })).status, 403);
  assert.equal((await api(`/orders/${o._id}/payments`, 'POST', { amount: 24691, reference: 'overpayment' })).status, 409);
  const payment = await api(`/orders/${o._id}/payments`, 'POST', { amount: 10000, reference: 'Synthetic transfer' }); assert.equal(payment.status, 201);
  assert.equal((await api(`/orders/${o._id}/transition`, 'POST', { status: 'cancelled' })).status, 409);
  assert.equal((await api(`/orders/${o._id}/transition`, 'POST', { status: 'fulfilled' })).status, 200);
  assert.equal((await api(`/orders/${o._id}/transition`, 'POST', { status: 'cancelled' })).status, 409);
  const dashboard = await api('/dashboard'); assert.ok(dashboard.body.totals.sales >= o.total); assert.ok(dashboard.body.totals.paid >= 10000);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const report = await api(`/reports?start=${today}&end=${today}`); assert.equal(report.status, 200); assert.ok(report.body.items.some(i => i._id === o._id));
  assert.ok(await Audit.countDocuments({ entityId: o._id }) >= 4);
});
test('idempotent creation and concurrent confirmation never double-deduct stock', async () => {
  const c = await customer(), p = await product(5); const key = crypto.randomUUID();
  const body = { customer: c._id, items: [{ product: p._id, quantity: 3 }] };
  const created = await Promise.all([api('/orders', 'POST', body, key), api('/orders', 'POST', body, key)]);
  assert.ok(created.every(r => r.status === 201)); assert.equal(created[0].body._id, created[1].body._id);
  assert.equal(await Order.countDocuments({ customer: c._id }), 1);
  assert.equal((await api('/orders', 'POST', { ...body, items: [{ product: p._id, quantity: 2 }] }, key)).status, 409);
  const o = created[0].body; const transitionKey = crypto.randomUUID();
  const results = await Promise.all([api(`/orders/${o._id}/transition`, 'POST', { status: 'confirmed' }, transitionKey), api(`/orders/${o._id}/transition`, 'POST', { status: 'confirmed' }, transitionKey)]);
  assert.ok(results.every(r => r.status === 200)); assert.equal((await Product.findById(p._id)).stock, 2); assert.equal(await Movement.countDocuments({ order: o._id }), 1);
  const o2 = await order(c, p, 2), o3 = await order(c, p, 2);
  const competing = await Promise.all([api(`/orders/${o2._id}/transition`, 'POST', { status: 'confirmed' }), api(`/orders/${o3._id}/transition`, 'POST', { status: 'confirmed' })]);
  assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]); assert.equal((await Product.findById(p._id)).stock, 0);
});
test('transaction failure rolls back all item deductions and order changes', async () => {
  const c = await customer(), a = await product(5), b = await product(0);
  const o = await api('/orders', 'POST', { customer: c._id, items: [{ product: a._id, quantity: 2 }, { product: b._id, quantity: 1 }] });
  assert.equal((await api(`/orders/${o.body._id}/transition`, 'POST', { status: 'confirmed' })).status, 409);
  assert.equal((await Product.findById(a._id)).stock, 5); assert.equal((await Order.findById(o.body._id)).status, 'draft'); assert.equal(await Movement.countDocuments({ order: o.body._id }), 0);
});
test('reversal and cancellation restore balances and inventory once', async () => {
  const c = await customer(), p = await product(4), o = await order(c, p, 2);
  await api(`/orders/${o._id}/transition`, 'POST', { status: 'confirmed' });
  const payment = await api(`/orders/${o._id}/payments`, 'POST', { amount: 100, reference: 'Synthetic' });
  const key = crypto.randomUUID(); assert.equal((await api(`/payments/${payment.body._id}/reverse`, 'POST', { reason: 'Correction' }, key)).status, 200);
  assert.equal((await api(`/payments/${payment.body._id}/reverse`, 'POST', { reason: 'Correction' }, key)).status, 200);
  assert.equal((await api(`/payments/${payment.body._id}/reverse`, 'POST', { reason: 'Again' })).status, 409);
  assert.equal((await Order.findById(o._id)).paid, 0);
  await api(`/orders/${o._id}/transition`, 'POST', { status: 'cancelled' }); assert.equal((await Product.findById(p._id)).stock, 4);
  assert.equal((await api(`/orders/${o._id}/transition`, 'POST', { status: 'cancelled' })).status, 409);
  assert.equal((await Product.findById(p._id)).stock, 4);
});
test('session expiration, deactivation, password change and logout revoke access', async () => {
  const manager = await client(fixture.base, 'Manager'); const user = await User.findOne({ role: 'Manager' });
  assert.equal((await api(`/users/${user._id}`, 'PATCH', { role: 'Manager', active: false })).status, 200); assert.equal((await manager('/auth/me')).status, 401);
  await api(`/users/${user._id}`, 'PATCH', { role: 'Manager', active: true });
  const fresh = await client(fixture.base, 'Manager'); assert.equal((await fresh('/auth/password', 'POST', { current: 'wrong', password: 'ChangedSynthetic123!' })).status, 400);
  assert.equal((await fresh('/auth/password', 'POST', { current: 'SyntheticPass123!', password: 'ChangedSynthetic123!' })).status, 200); assert.equal((await fresh('/auth/me')).status, 401);
  const staffUser = await User.findOne({ role: 'Staff' }); await Session.updateMany({ user: staffUser._id }, { $set: { expiresAt: new Date(0) } }); assert.equal((await staff('/auth/me')).status, 401);
  const logoutClient = await client(fixture.base); await logoutClient('/auth/logout', 'POST'); assert.equal((await logoutClient('/auth/me')).status, 401);
});
test('dashboard totals are exact and reports enforce dates, balance filtering and inventory pagination', async () => {
  const before = (await api('/dashboard')).body;
  const c = await customer(), p = await product(0, 'service'), o = await order(c, p, 3);
  assert.equal((await api(`/orders/${o._id}/transition`, 'POST', { status: 'confirmed' })).status, 200);
  const after = (await api('/dashboard')).body; assert.equal(after.totals.sales - before.totals.sales, 37035); assert.equal(after.totals.orders - before.totals.orders, 1); assert.equal((await Product.findById(p._id)).stock, 0);
  assert.equal((await api('/reports?start=2026-12-31&end=2026-01-01')).status, 400);
  assert.equal((await api('/reports?start=2020-01-01&end=2026-01-01')).status, 400);
  const inventory = await api('/reports/inventory'); assert.equal(inventory.status, 200); assert.ok(inventory.body.items.every(i => i.stock >= 0));
  assert.equal((await api('/reports/inventory?page=-1')).status, 400);
});
test('simultaneous payments cannot exceed the order balance', async () => {
  const c = await customer(), p = await product(1), o = await order(c, p); await api(`/orders/${o._id}/transition`, 'POST', { status: 'confirmed' });
  const results = await Promise.all([api(`/orders/${o._id}/payments`, 'POST', { amount: 10000, reference: 'A' }), api(`/orders/${o._id}/payments`, 'POST', { amount: 10000, reference: 'B' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]); assert.equal((await Order.findById(o._id)).paid, 10000);
});
test('archived products cannot be confirmed and duplicate lines are rejected', async () => {
  const c = await customer(), p = await product(3), o = await order(c, p);
  assert.equal((await api('/orders', 'POST', { customer: c._id, items: [{ product: p._id, quantity: 1 }, { product: p._id, quantity: 1 }] })).status, 400);
  await api(`/products/${p._id}`, 'PATCH', { sku: p.sku, name: p.name, type: p.type, price: p.price, reorderLevel: p.reorderLevel, archived: true });
  assert.equal((await api(`/orders/${o._id}/transition`, 'POST', { status: 'confirmed' })).status, 409); assert.equal((await Product.findById(p._id)).stock, 3);
  assert.equal((await api(`/products/${p._id}`, 'PATCH', { sku: p.sku, name: p.name, type: 'service', price: p.price, reorderLevel: 0 })).status, 409);
  assert.equal((await api(`/products/${p._id}/adjust`, 'POST', { delta: -4, reason: 'Negative' })).status, 409);
});
test('application processes restart without losing persisted business records or sessions', async () => {
  const restartKey = crypto.randomUUID(); const c = await customer(), p = await product(2), o = await order(c, p, 1, restartKey);
  const me = await api('/auth/me'); const sessionUser = me.body.user._id;
  let cookie, csrf;
  async function start() {
    const child = fork('server/index.js', [], { env: { ...process.env, MONGODB_URI: fixture.db.getUri('boms_test'), PORT: '0', NODE_ENV: 'test', APP_ORIGIN: fixture.base }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    const port = await new Promise((resolve, reject) => { const timer = setTimeout(() => { child.kill(); reject(new Error('Restart fixture timed out')); }, 15000); child.once('message', data => { clearTimeout(timer); resolve(data.port); }); child.once('exit', code => { clearTimeout(timer); if (code) reject(new Error('Restart process exited')); }); child.once('error', reject); });
    return { child, base: `http://127.0.0.1:${port}`, close: async () => { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped; } };
  }
  const first = await start();
  try { const login = await fetch(`${first.base}/api/auth/login`, { method: 'POST', headers: { Origin: fixture.base, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'administrator@example.test', password: 'SyntheticPass123!' }) }); assert.equal(login.status, 200); cookie = login.headers.get('set-cookie').split(';')[0]; csrf = (await login.json()).csrf; } finally { await first.close(); }
  const second = await start();
  try { const response = await fetch(`${second.base}/api/orders/${o._id}`, { headers: { Cookie: cookie } }); assert.equal(response.status, 200); const persisted = await response.json(); assert.equal(persisted.customer, c._id); assert.equal(persisted.total, o.total); const responseMe = await fetch(`${second.base}/api/auth/me`, { headers: { Cookie: cookie } }); assert.equal((await responseMe.json()).user._id, sessionUser);
    const replay = await fetch(`${second.base}/api/orders`, { method: 'POST', headers: { Cookie: cookie, Origin: fixture.base, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json', 'Idempotency-Key': restartKey }, body: JSON.stringify({ customer: c._id, items: [{ product: p._id, quantity: 1 }] }) }); assert.equal(replay.status, 201); assert.equal((await replay.json())._id, o._id);
  } finally { await second.close(); }
});
test('administrator account creation does not expose credentials and self access changes are refused', async () => {
  const body = { name: 'Synthetic New Staff', email: 'new-staff@example.test', password: 'SyntheticNewPassword123!', role: 'Staff' };
  const key = crypto.randomUUID(); const result = await api('/users', 'POST', body, key); assert.equal(result.status, 201); assert.equal(result.body.passwordHash, undefined); assert.equal(JSON.stringify(result.body).includes(body.password), false);
  assert.equal((await api('/users', 'POST', body, key)).body._id, result.body._id); assert.equal((await api('/users', 'POST', { ...body, password: 'DifferentPassword123!' }, key)).status, 409);
  const me = (await api('/auth/me')).body.user; assert.equal((await api(`/users/${me._id}`, 'PATCH', { active: false, role: 'Staff' })).status, 409);
  assert.ok((await api('/users')).body.items.every(user => !user.passwordHash));
});
test('standalone MongoDB startup is refused rather than accepting partial-write workflows', async () => {
  const standalone = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  try {
    const child = fork('server/index.js', [], { env: { ...process.env, MONGODB_URI: standalone.getUri('boms_standalone_test'), PORT: '0', NODE_ENV: 'test' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); let stderr = ''; child.stderr.on('data', data => { stderr += data; });
    const code = await new Promise((resolve, reject) => { const timer = setTimeout(() => { child.kill(); reject(new Error('Standalone rejection timed out')); }, 15000); child.once('exit', code => { clearTimeout(timer); resolve(code); }); child.once('error', reject); });
    assert.equal(code, 1); assert.match(stderr, /transaction-capable MongoDB replica set/);
  } finally { await standalone.stop(); }
});
test('malformed/oversized payloads are sanitized and login abuse returns JSON 429', async () => {
  const malformed = await fetch(`${fixture.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":"DO-NOT-ECHO",' }); assert.equal(malformed.status, 400); const payload = await malformed.json(); assert.equal(payload.error, 'Malformed JSON request'); assert.ok(payload.requestId); assert.equal(JSON.stringify(payload).includes('DO-NOT-ECHO'), false);
  const oversized = await fetch(`${fixture.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(40000) }) }); assert.equal(oversized.status, 413);
  const results = []; for (let i = 0; i < 25; i++) results.push(await api('/auth/login', 'POST', {})); assert.ok(results.some(r => r.status === 429)); assert.ok(results.filter(r => r.status === 429).every(r => typeof r.body.error === 'string'));
});
test('additive index setup and first-admin bootstrap run reproducibly without resets', async () => {
  await mkdir('.cache', { recursive: true });
  const temporaryConfig = await mkdtemp(resolve('.cache', 'setup-'));
  try {
    await copyFile('.env.example', join(temporaryConfig, '.env.example'));
    async function configure() { const child = spawn(process.execPath, [resolve('scripts/configure.js')], { cwd: temporaryConfig, stdio: 'ignore' }); return new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); }); }
    assert.equal(await configure(), 0); const original = await readFile(join(temporaryConfig, '.env'), 'utf8'); assert.match(original, /IDEMPOTENCY_SECRET=[a-f0-9]{64}/);
    assert.equal(await configure(), 1); assert.equal(await readFile(join(temporaryConfig, '.env'), 'utf8'), original);
  } finally { await unlink(join(temporaryConfig, '.env')); await unlink(join(temporaryConfig, '.env.example')); await rmdir(temporaryConfig); }
  const env = { ...process.env, MONGODB_URI: fixture.db.getUri('boms_setup_test'), ADMIN_EMAIL: 'bootstrap@example.test', ADMIN_PASSWORD: 'SyntheticBootstrap123!' };
  async function run(script) { const child = spawn(process.execPath, [script], { env, stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; }); const code = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); }); assert.equal(output.includes(env.ADMIN_PASSWORD), false); return { code, output }; }
  assert.equal((await run('scripts/indexes.js')).code, 0);
  assert.equal((await run('scripts/seed.js')).code, 0);
  const duplicate = await run('scripts/seed.js'); assert.equal(duplicate.code, 1); assert.match(duplicate.output, /Administrator already exists/);
  // Reapplying declared indexes leaves the existing account untouched.
  assert.equal((await run('scripts/indexes.js')).code, 0);
});
test('unsafe aggregate amounts are refused instead of silently rounded', async () => {
  // Deliberately corrupt only this isolated local fixture, bypassing model validation.
  const c = await customer(), p = await product(0, 'service'), o = await order(c, p);
  await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(o._id) }, { $set: { total: Number.MAX_SAFE_INTEGER * 2, status: 'confirmed' } });
  try { assert.equal((await api('/dashboard')).status, 503); }
  finally { await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(o._id) }, { $set: { total: o.total, status: 'draft' } }); }
});

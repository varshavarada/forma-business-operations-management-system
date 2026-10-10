import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startFixture, client } from './helpers.js';
import { Customer, Product, Order, User } from '../server/models.js';
import { businessMonth, sixMonthPeriod } from '../server/reporting-period.js';
let fixture, api;
before(async () => { fixture = await startFixture(); api = await client(fixture.base); });
after(async () => { if (fixture) await fixture.close(); });

test('Kolkata calendar-month arithmetic crosses year and UTC boundaries', () => {
  assert.equal(businessMonth(new Date('2026-04-30T18:29:59.999Z')), '2026-04');
  assert.equal(businessMonth(new Date('2026-04-30T18:30:00.000Z')), '2026-05');
  const period = sixMonthPeriod('2026-02');
  assert.deepEqual(period.months, ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  assert.equal(period.from.toISOString(), '2025-08-31T18:30:00.000Z');
  assert.equal(period.to.toISOString(), '2026-02-28T18:30:00.000Z');
});

test('monthly dashboard respects inclusive/exclusive Kolkata boundaries, statuses and empty months', async () => {
  const customer = await Customer.create({ code: 'BOUNDARY-C', name: 'Boundary Studio' });
  const product = await Product.create({ sku: 'BOUNDARY-S', name: 'Boundary Setup', type: 'service', price: 100, reorderLevel: 0 });
  const user = await User.findOne({ role: 'Administrator' });
  for (const [i, [createdAt, status, quantity]] of [
    ['2026-04-30T18:29:59.999Z', 'confirmed', 1],
    ['2026-04-30T18:30:00.000Z', 'confirmed', 2],
    ['2026-05-31T18:29:59.999Z', 'fulfilled', 3],
    ['2026-05-31T18:30:00.000Z', 'confirmed', 4],
    ['2026-10-31T18:29:59.999Z', 'fulfilled', 5],
    ['2026-10-31T18:30:00.000Z', 'confirmed', 6],
    ['2026-07-15T03:30:00.000Z', 'draft', 7],
    ['2026-08-15T03:30:00.000Z', 'cancelled', 8]
  ].entries()) await Order.create({ number: `BOUNDARY-${i}`, customer: customer._id, customerName: customer.name, items: [{ product: product._id, name: product.name, type: product.type, price: 100, quantity }], total: quantity * 100, status, createdBy: user._id, createdAt: new Date(createdAt) });
  const response = await api('/dashboard?trend=monthly&month=2026-10');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.trend, [{ _id: '2026-05', total: 500 }, { _id: '2026-06', total: 400 }, { _id: '2026-07', total: 0 }, { _id: '2026-08', total: 0 }, { _id: '2026-09', total: 0 }, { _id: '2026-10', total: 500 }]);
  assert.equal(response.body.trendPeriod.total, 1400); assert.equal(response.body.totals.sales, 2100);
  assert.equal(response.body.trendPeriod.start, '2026-04-30T18:30:00.000Z'); assert.equal(response.body.trendPeriod.endExclusive, '2026-10-31T18:30:00.000Z');
  const empty = await api('/dashboard?trend=monthly&month=2025-10');
  assert.equal(empty.body.trend.length, 6); assert.ok(empty.body.trend.every(row => row.total === 0));
  const daily = await api('/dashboard'); assert.equal(daily.status, 200); assert.equal(daily.body.trendPeriod.mode, 'daily');
  for (const query of ['trend=yearly', 'trend=monthly&month=2026-13', 'trend=monthly&month=0000-01']) assert.equal((await api(`/dashboard?${query}`)).status, 400);
});

test('optional catalog descriptions remain bounded and survive older edit payloads', async () => {
  const payload = { sku: 'DESCRIPTION-S', name: 'Workstation Setup', type: 'service', price: 180000, reorderLevel: 0 };
  const created = await api('/products', 'POST', { ...payload, description: 'Configure a customer-supplied workstation.' });
  assert.equal(created.status, 201);
  const edited = await api(`/products/${created.body._id}`, 'PATCH', { ...payload, price: 190000 });
  assert.equal(edited.status, 200); assert.equal(edited.body.description, created.body.description);
  assert.equal((await api('/products', 'POST', { ...payload, sku: 'LONG-DESCRIPTION', description: 'x'.repeat(241) })).status, 400);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startProfessionalDemo } from '../scripts/professional-demo.js';
import { professionalPlan } from '../scripts/professional-data.js';
import { startFixture } from './helpers.js';
import { Customer, Product, Order, User } from '../server/models.js';

test('professional scenario is deterministic and satisfies the exact planning targets', () => {
  const first = professionalPlan(), second = professionalPlan();
  assert.deepEqual(first, second);
  assert.equal(first.customers.length, 150); assert.equal(first.products.length, 40); assert.equal(first.orders.length, 200);
  assert.equal(new Set(first.customers.map(customer => customer.name)).size, 150);
  assert.equal(new Set(first.customers.map(customer => customer.name.split(' ')[0])).size, 150);
  assert.equal(first.customers[0].code, 'FORMA-C-001');
  assert.equal(first.customers[0].email, 'office@amberbrook-1.example.test');
  assert.equal(first.customers[149].code, 'FORMA-C-150');
  assert.equal(first.customers[149].email, 'office@juniper-bay-10.example.test');
  assert.ok(first.customers.every(customer => customer.email.endsWith('.example.test')));
  assert.deepEqual(first.period.months, ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.throws(() => professionalPlan('2026-02-30'));
});

test('professional temporary database reconciles workflows and leaves the default fixture minimal', { timeout: 600000 }, async () => {
  const previous = process.env.MONGODB_URI;
  process.env.MONGODB_URI = 'mongodb://invalid.example.test:1/do_not_connect';
  let fixture;
  try {
    fixture = await startProfessionalDemo();
    const result = fixture.verification, plan = fixture.plan;
    assert.equal(result.status, 'reconciled');
    assert.deepEqual(result.counts, { customers: 150, products: 30, services: 10, orders: 200, payments: 160, movements: 430, audits: 930, operations: 930 });
    assert.equal(result.salesMinorUnits, plan.orders.reduce((sum, order) => sum + order.total, 0));
    assert.equal(result.paidMinorUnits, plan.orders.reduce((sum, order) => sum + order.paid, 0));
    assert.equal(result.salesMinorUnits, 1709025000);
    assert.equal(result.paidMinorUnits, 1105657500);
    const orders = await Order.find().lean();
    assert.equal(orders.filter(order => order.status === 'fulfilled').length, 150);
    assert.equal(orders.filter(order => order.paid === 0).length, 40);
    assert.equal(orders.filter(order => order.paid > 0 && order.paid < order.total).length, 80);
    assert.equal(orders.filter(order => order.paid === order.total).length, 80);
    // No public creation endpoint permits client-supplied history.
    assert.equal((await fixture.api('/orders', 'POST', { customer: String(orders[0].customer), items: [{ product: String(orders[0].items[0].product), quantity: 1 }], createdAt: '2020-01-01' })).status, 400);
    await fixture.close(); fixture = null;
    const minimal = await startFixture();
    try {
      assert.equal(await Customer.countDocuments(), 0); assert.equal(await Product.countDocuments(), 0); assert.equal(await Order.countDocuments(), 0);
      assert.equal((await User.findOne({ role: 'Administrator' })).name, 'Test Administrator');
    } finally { await minimal.close(); }
  } finally {
    if (fixture) await fixture.close();
    if (previous === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = previous;
  }
});

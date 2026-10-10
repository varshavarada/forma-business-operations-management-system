import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Customer, Product, Order, Payment, Movement, Audit, Operation, User } from '../server/models.js';

// Read-only reconciliation, shared by startup, capture and the dedicated integration test.
export async function verifyProfessionalDemo(plan, api) {
  const models = [Customer, Product, Order, Payment, Movement, Audit, Operation, User];
  const [customers, products, orders, payments, movements, audits, operations, users] = await Promise.all(models.map(Model => Model.find().limit(2000).lean()));
  const unique = (rows, field) => assert.equal(new Set(rows.map(row => String(row[field]))).size, rows.length, `Duplicate ${field}`);
  assert.equal(customers.length, 150); assert.equal(products.length, 40); assert.equal(orders.length, 200);
  assert.equal(payments.length, 160); assert.equal(movements.length, 430); assert.equal(audits.length, 930); assert.equal(operations.length, 930); assert.equal(users.length, 3);
  for (const [rows, field] of [[customers, 'code'], [products, 'sku'], [orders, 'number'], [operations, 'key']]) unique(rows, field);
  const customerById = new Map(customers.map(row => [String(row._id), row]));
  const productById = new Map(products.map(row => [String(row._id), row]));
  const orderById = new Map(orders.map(row => [String(row._id), row]));
  const paymentById = new Map(payments.map(row => [String(row._id), row]));
  const paymentsByOrder = Map.groupBy(payments, row => String(row.order));
  const movementsByOrder = Map.groupBy(movements, row => String(row.order));
  const movementsByProduct = Map.groupBy(movements, row => String(row.product));
  const expectedOrders = new Map(plan.orders.map(row => [+row.createdAt, row]));
  const userIds = new Set(users.map(row => String(row._id)));
  const expectedCustomers = new Map(plan.customers.map(row => [row.code, row]));
  const expectedProducts = new Map(plan.products.map((row, i) => [row.sku, { ...row, opening: plan.opening[i] }]));
  for (const customer of customers) {
    const expected = expectedCustomers.get(customer.code); assert.ok(expected);
    for (const field of ['name', 'email', 'phone']) assert.equal(customer[field], expected[field]);
    assert.equal(customer.archived, false); assert.ok(customer.updatedAt >= customer.createdAt);
  }
  for (const product of products) {
    const expected = expectedProducts.get(product.sku); assert.ok(expected);
    for (const field of ['name', 'description', 'price', 'type', 'reorderLevel']) assert.equal(product[field], expected[field]);
    assert.equal(product.archived, false); assert.ok(product.updatedAt >= product.createdAt);
  }
  const auditByAction = new Map(audits.map(row => [`${row.action}:${row.entityId}`, row]));
  const monthly = new Map(plan.period.months.map(month => [month, 0]));
  let sales = 0, paid = 0;
  for (const order of orders) {
    const id = String(order._id), customer = customerById.get(String(order.customer));
    assert.ok(customer && userIds.has(String(order.createdBy))); assert.equal(order.customerName, customer.name);
    assert.ok(order.createdAt >= plan.period.from && order.createdAt <= new Date(`${plan.referenceDate}T23:59:59.999+05:30`));
    assert.ok(customer.createdAt <= order.createdAt);
    const expected = expectedOrders.get(+order.createdAt);
    assert.ok(expected); assert.equal(customer.code, plan.customers[expected.customer].code); assert.equal(order.total, expected.total); assert.equal(order.paid, expected.paid); assert.equal(order.status, expected.status);
    assert.ok(['confirmed', 'fulfilled'].includes(order.status));
    assert.ok(order.items.length >= 1 && order.items.length <= 50); unique(order.items, 'product');
    let total = 0;
    for (const item of order.items) {
      const product = productById.get(String(item.product));
      assert.ok(product && product.createdAt <= order.createdAt);
      assert.equal(item.name, product.name); assert.equal(item.type, product.type); assert.equal(item.price, product.price);
      assert.ok(Number.isSafeInteger(item.quantity) && item.quantity > 0);
      total += item.price * item.quantity;
    }
    assert.ok(Number.isSafeInteger(total)); assert.equal(total, order.total); assert.ok(order.paid >= 0 && order.paid <= total);
    const history = paymentsByOrder.get(id) || [];
    assert.equal(history.reduce((sum, payment) => sum + payment.amount, 0), order.paid);
    const created = auditByAction.get(`order.created:${id}`), confirmed = auditByAction.get(`order.confirmed:${id}`);
    assert.ok(created && confirmed); assert.equal(+created.createdAt, +order.createdAt); assert.ok(confirmed.createdAt > order.createdAt);
    const deductions = movementsByOrder.get(id) || [];
    assert.equal(deductions.length, order.items.filter(item => item.type === 'product').length);
    for (const item of order.items) if (item.type === 'product') {
      const matches = deductions.filter(movement => String(movement.product) === String(item.product));
      assert.equal(matches.length, 1); assert.equal(matches[0].delta, -item.quantity); assert.equal(+matches[0].createdAt, +confirmed.createdAt);
    }
    for (const payment of history) {
      assert.ok(payment.createdAt > confirmed.createdAt && payment.createdAt <= order.updatedAt);
      assert.ok(!payment.reversed && !payment.reversalOf && payment.amount > 0); // Scenario deliberately has no reversals.
      assert.equal(+auditByAction.get(`payment.recorded:${id}`).createdAt, +payment.createdAt);
    }
    const fulfilled = auditByAction.get(`order.fulfilled:${id}`);
    if (order.status === 'fulfilled') {
      assert.ok(fulfilled && fulfilled.createdAt > confirmed.createdAt);
      assert.ok(history.every(payment => payment.createdAt < fulfilled.createdAt));
      assert.equal(+order.updatedAt, +fulfilled.createdAt);
    } else assert.equal(+order.updatedAt, +(history[0]?.createdAt || confirmed.createdAt));
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(order.createdAt);
    assert.ok(monthly.has(month)); monthly.set(month, monthly.get(month) + total);
    sales += total; paid += order.paid;
  }
  for (const payment of payments) assert.ok(orderById.has(String(payment.order)) && userIds.has(String(payment.actor)));
  for (const movement of movements) assert.ok(productById.has(String(movement.product)) && (!movement.order || orderById.has(String(movement.order))));
  let units = 0;
  for (const product of products) {
    const history = (movementsByProduct.get(String(product._id)) || []).sort((a, b) => a.createdAt - b.createdAt);
    if (product.type === 'service') { assert.equal(product.stock, 0); assert.equal(history.length, 0); continue; }
    assert.equal(history.filter(movement => !movement.order).length, 1);
    assert.equal(history.find(movement => !movement.order).delta, expectedProducts.get(product.sku).opening);
    let stock = 0;
    for (const movement of history) {
      assert.ok(userIds.has(String(movement.actor))); assert.ok(Number.isSafeInteger(movement.delta));
      if (movement.order) { assert.ok(orderById.has(String(movement.order))); assert.equal(movement.reason, 'confirmed'); }
      else { assert.ok(movement.delta > 0); assert.equal(movement.reason, 'Fictional opening inventory'); }
      stock += movement.delta; assert.ok(stock >= 0 && stock <= 1000000000);
    }
    assert.equal(stock, product.stock); units += stock;
  }
  for (const audit of audits) {
    assert.ok(userIds.has(String(audit.actor)) && +audit.createdAt === +audit.updatedAt);
    const targets = { customers: customerById, products: productById, product: productById, order: orderById };
    assert.ok(targets[audit.entity]?.has(audit.entityId));
  }
  for (const operation of operations) {
    assert.equal(+operation.createdAt, +operation.updatedAt);
    assert.equal(+new Date(operation.result.updatedAt), +operation.createdAt);
    assert.ok(new Date(operation.result.createdAt) <= operation.createdAt);
    const entity = [customerById, productById, orderById, paymentById].map(map => map.get(String(operation.result._id))).find(Boolean);
    assert.ok(entity); assert.equal(+new Date(operation.result.createdAt), +entity.createdAt);
  }
  assert.equal(users.find(user => user.role === 'Administrator').name, 'Ananya Mehta');
  const dashboard = await api(`/dashboard?trend=monthly&month=${plan.referenceDate.slice(0, 7)}`);
  assert.equal(dashboard.status, 200); assert.deepEqual(dashboard.body.trend, [...monthly].map(([month, total]) => ({ _id: month, total })));
  assert.equal(dashboard.body.totals.sales, sales); assert.equal(dashboard.body.totals.paid, paid); assert.equal(dashboard.body.totals.orders, 200); assert.equal(dashboard.body.trendPeriod.total, sales);
  const start = `${plan.period.months[0]}-01`;
  const report = await api(`/reports?start=${start}&end=${plan.referenceDate}`);
  assert.equal(report.status, 200); assert.deepEqual(report.body.summary, { _id: null, sales, paid, count: 200 }); assert.equal(report.body.items.length, 200); assert.equal(report.body.truncated, false);
  const outstanding = await api(`/reports?start=${start}&end=${plan.referenceDate}&mode=outstanding`);
  assert.equal(outstanding.status, 200); assert.equal(outstanding.body.summary.sales - outstanding.body.summary.paid, sales - paid);
  for (const [path, count] of [['customers', 150], ['products', 40], ['orders', 200]]) {
    const listing = await api(`/${path}`); assert.equal(listing.status, 200); assert.equal(listing.body.total, count); assert.equal(listing.body.items.length, 20);
  }
  for (const page of [1, 2]) {
    const inventory = await api(`/reports/inventory?page=${page}`); assert.equal(inventory.status, 200); assert.equal(inventory.body.total, 30);
    for (const item of inventory.body.items) assert.equal(item.stock, productById.get(item._id).stock);
  }
  const datasetFingerprint = createHash('sha256').update(JSON.stringify({ customers: plan.customers, products: plan.products, orders: plan.orders, opening: plan.opening })).digest('hex');
  return { referenceDate: plan.referenceDate, seed: plan.seed, datasetFingerprint, counts: { customers: customers.length, products: 30, services: 10, orders: orders.length, payments: payments.length, movements: movements.length, audits: audits.length, operations: operations.length }, salesMinorUnits: sales, paidMinorUnits: paid, outstandingMinorUnits: sales - paid, stockUnits: units, monthlySales: dashboard.body.trend, status: 'reconciled' };
}

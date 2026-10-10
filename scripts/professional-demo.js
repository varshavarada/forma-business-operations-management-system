import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { app, initialize } from '../server/app.js';
import { Customer, Product, Order, Payment, Movement, Audit, Operation, User } from '../server/models.js';
import { client } from '../tests/helpers.js';
import { professionalPlan } from './professional-data.js';
import { verifyProfessionalDemo } from './professional-verify.js';

// No URI parameter: this entry point can only create its own temporary replica set.
export async function startProfessionalDemo({ referenceDate, onProgress = () => {}, signal } = {}) {
  if (mongoose.connection.readyState !== 0) throw new Error('Professional demo requires a disconnected process; start it with npm run demo:professional.');
  const plan = professionalPlan(referenceDate);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  if (plan.referenceDate > today) throw new Error('The demo reference date must not be in the future. Use --reference-date=YYYY-MM-DD.');
  let db, server, closing;
  const close = () => closing ||= (async () => {
    try { if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    finally { try { await mongoose.disconnect(); } finally { if (db) await db.stop(); } }
  })();
  try {
    process.env.NODE_ENV = 'test';
    process.env.CURRENCY = 'INR';
    process.env.IDEMPOTENCY_SECRET = randomBytes(32).toString('hex');
    db = new MongoMemoryReplSet({ replSet: { count: 1, ip: '127.0.0.1' }, binary: { version: '7.0.14' } });
    await db.start();
    const uri = db.getUri('boms_professional');
    await mongoose.connect(uri);
    const assertIsolated = () => {
      signal?.throwIfAborted();
      if (!db || mongoose.connection.name !== 'boms_professional' || mongoose.connection.host !== '127.0.0.1' || mongoose.connection.getClient().options.hosts[0].toString() !== new URL(uri).host) throw new Error('Temporary demo connection identity changed; refusing writes.');
    };
    assertIsolated();
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    await initialize();
    const passwordHash = await argon2.hash('SyntheticPass123!');
    const foundation = new Date(plan.period.from.getTime() - 3 * 86400000);
    for (const [role, name] of [['Administrator', 'Ananya Mehta'], ['Manager', 'Rohan Iyer'], ['Staff', 'Kavya Rao']]) {
      await User.create({ name, role, email: `${role.toLowerCase()}@example.test`, passwordHash, createdAt: foundation, updatedAt: foundation });
    }
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    process.env.APP_ORIGIN = base;
    const api = await client(base);
    const events = [], created = new Map(), latest = new Map(), auditTimes = new Map();
    let sequence = 0, lastRequest = Date.now();
    async function perform(path, body, action, entity, time) {
      assertIsolated();
      // <= 240 requests/minute, leaving room for verification and browser reads.
      await delay(Math.max(0, 250 - (Date.now() - lastRequest)), undefined, { signal });
      lastRequest = Date.now();
      const key = `forma-professional-${String(++sequence).padStart(4, '0')}`;
      const response = await api(path, 'POST', body, key);
      if (![200, 201].includes(response.status)) throw new Error(`Demo workflow failed at ${path}: ${response.status} ${response.body.error}`);
      const result = response.body;
      const entityId = entity === 'payment' ? result.order : result._id;
      const identity = `${entity}:${result._id}`;
      if (!created.has(identity)) created.set(identity, time);
      latest.set(identity, time);
      auditTimes.set(`${action}:${entityId}`, time);
      events.push({ key, identity, time });
      return result;
    }
    const customerTime = new Date(plan.period.from.getTime() - 2 * 86400000);
    const productTime = new Date(plan.period.from.getTime() - 86400000);
    const openingTime = new Date(plan.period.from.getTime() + 8 * 3600000);
    const customers = [], products = [];
    for (const data of plan.customers) customers.push(await perform('/customers', data, 'customers.created', 'customer', customerTime));
    onProgress('150 fictional customers created');
    for (const data of plan.products) products.push(await perform('/products', data, 'products.created', 'product', productTime));
    for (const [i, data] of products.entries()) if (data.type === 'product') await perform(`/products/${data._id}/adjust`, { delta: plan.opening[i], reason: 'Fictional opening inventory' }, 'stock.adjusted', 'product', openingTime);
    onProgress('40 catalog items and opening inventory created');
    const orderTimes = new Map();
    for (const [i, data] of plan.orders.entries()) {
      const confirmed = new Date(data.createdAt.getTime() + 3600000);
      const paid = new Date(data.createdAt.getTime() + 3 * 3600000);
      const fulfilled = new Date(data.createdAt.getTime() + 5 * 3600000);
      const order = await perform('/orders', { customer: customers[data.customer]._id, items: data.items.map(item => ({ product: products[item.product]._id, quantity: item.quantity })) }, 'order.created', 'order', data.createdAt);
      orderTimes.set(order._id, { created: data.createdAt, confirmed, paid, fulfilled });
      await perform(`/orders/${order._id}/transition`, { status: 'confirmed' }, 'order.confirmed', 'order', confirmed);
      latest.set(`customer:${customers[data.customer]._id}`, confirmed);
      for (const item of data.items) latest.set(`product:${products[item.product]._id}`, confirmed);
      if (data.paid) {
        await perform(`/orders/${order._id}/payments`, { amount: data.paid, reference: `Fictional bank receipt FORMA-${String(i + 1).padStart(3, '0')}` }, 'payment.recorded', 'payment', paid);
        latest.set(`order:${order._id}`, paid);
      }
      if (data.status === 'fulfilled') await perform(`/orders/${order._id}/transition`, { status: 'fulfilled' }, 'order.fulfilled', 'order', fulfilled);
      if ((i + 1) % 50 === 0) onProgress(`${i + 1}/200 orders completed through normal workflows`);
    }
    assertIsolated();
    // Private fixture-only timestamp finalization. No route accepts historical dates.
    // Raw collection updates are needed because Mongoose protects createdAt on updates.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        assertIsolated();
        for (const [Model, entity] of [[Customer, 'customer'], [Product, 'product'], [Order, 'order'], [Payment, 'payment']]) {
          const docs = await Model.find().session(session).select('_id').lean();
          await Model.collection.bulkWrite(docs.map(doc => ({ updateOne: { filter: { _id: doc._id }, update: { $set: { createdAt: created.get(`${entity}:${doc._id}`), updatedAt: latest.get(`${entity}:${doc._id}`) } } } })), { session });
        }
        const movements = await Movement.find().session(session).lean();
        await Movement.collection.bulkWrite(movements.map(doc => {
          const time = doc.order ? orderTimes.get(String(doc.order)).confirmed : openingTime;
          return { updateOne: { filter: { _id: doc._id }, update: { $set: { createdAt: time, updatedAt: time } } } };
        }), { session });
        const audits = await Audit.find().session(session).lean();
        await Audit.collection.bulkWrite(audits.map(doc => {
          const time = auditTimes.get(`${doc.action}:${doc.entityId}`);
          if (!time) throw new Error(`Missing demo audit chronology: ${doc.action}`);
          return { updateOne: { filter: { _id: doc._id }, update: { $set: { createdAt: time, updatedAt: time } } } };
        }), { session });
        const administrator = await User.findOne({ role: 'Administrator' }).session(session).lean();
        const operations = await Operation.find().session(session).lean();
        const byKey = new Map(events.map(event => [`${administrator._id}:${event.key}`, event]));
        await Operation.collection.bulkWrite(operations.map(doc => {
          const event = byKey.get(doc.key);
          if (!event) throw new Error('Unexpected operation in isolated demo');
          const result = { ...doc.result, createdAt: created.get(event.identity), updatedAt: event.time };
          return { updateOne: { filter: { _id: doc._id }, update: { $set: { createdAt: event.time, updatedAt: event.time, result } } } };
        }), { session });
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } finally { await session.endSession(); }
    onProgress('Historical chronology finalized; reconciling data');
    const verification = await verifyProfessionalDemo(plan, api);
    signal?.throwIfAborted();
    return { base, close, plan, verification, api };
  } catch (error) {
    await close();
    throw new Error(`Professional demo stopped safely: ${error.message}. No configured persistent database was used.`, { cause: error });
  }
}

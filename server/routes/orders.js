import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Customer, Product, Order, Movement, Payment } from '../models.js';
import { fail, id, text, money, positive, parse, manager, audit, mutate } from '../core.js';

export function registerOrders(app) {
app.post('/api/orders', async (req, res) => {
  const data = parse(z.object({ customer: id, items: z.array(z.object({ product: id, quantity: positive }).strict()).min(1).max(50) }), req.body);
  if (new Set(data.items.map(i => i.product)).size !== data.items.length) fail(400, 'Combine duplicate product lines');
  res.status(201).json(await mutate(req, async session => {
    const customer = await Customer.findOne({ _id: data.customer, archived: false }).session(session); if (!customer) fail(404, 'Customer unavailable');
    const products = await Product.find({ _id: { $in: data.items.map(i => i.product) }, archived: false }).session(session).lean();
    const lookup = new Map(products.map(p => [String(p._id), p]));
    const items = data.items.map(i => { const p = lookup.get(i.product); if (!p) fail(404, 'Catalog item unavailable'); return { product: p._id, name: p.name, type: p.type, price: p.price, quantity: i.quantity }; });
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0); if (!Number.isSafeInteger(total) || total > 100000000000) fail(400, 'Order total exceeds limit');
    const [order] = await Order.create([{ number: `SO-${randomUUID().slice(0, 12).toUpperCase()}`, customer: customer._id, customerName: customer.name, items, total, createdBy: req.user._id }], { session });
    await audit(req, 'order.created', 'order', order._id, session); return order.toObject();
  }));
});
app.post('/api/orders/:id/transition', async (req, res) => {
  const orderId = id.parse(req.params.id); const { status } = parse(z.object({ status: z.enum(['confirmed', 'fulfilled', 'cancelled']) }), req.body);
  if (status !== 'confirmed' && req.user.role === 'Staff') fail(403, 'Manager permission required');
  res.json(await mutate(req, async session => {
    const order = await Order.findById(orderId).session(session); if (!order) fail(404, 'Order not found');
    if (!(order.status === 'draft' && ['confirmed', 'cancelled'].includes(status) || order.status === 'confirmed' && ['fulfilled', 'cancelled'].includes(status))) fail(409, 'Invalid order transition');
    if (status === 'cancelled' && order.paid !== 0) fail(409, 'Reverse payment records before cancellation');
    if (status === 'confirmed') {
      const customer = await Customer.findOne({ _id: order.customer, archived: false }).session(session); if (!customer) fail(409, 'Customer is archived');
      // Writes on referenced records conflict with concurrent archival changes.
      await Customer.updateOne({ _id: customer._id }, { $inc: { version: 1 } }, { session });
    }
    for (const item of order.items) {
      const delta = status === 'confirmed' ? -item.quantity : order.status === 'confirmed' && status === 'cancelled' ? item.quantity : 0;
      if (status === 'confirmed' || delta > 0) {
        const filter = { _id: item.product, ...(status === 'confirmed' ? { archived: false, ...(item.type === 'product' ? { stock: { $gte: item.quantity } } : {}) } : item.type === 'product' ? { stock: { $lte: 1000000000 - delta } } : {}) };
        const update = { $inc: { version: 1, ...(item.type === 'product' ? { stock: delta } : {}) } };
        const result = await Product.updateOne(filter, update, { session }); if (result.matchedCount !== 1) fail(409, `Unavailable item or insufficient stock: ${item.name}`);
        if (item.type === 'product') await Movement.create([{ product: item.product, order: order._id, delta, reason: status, actor: req.user._id }], { session });
      }
    }
    order.status = status; await order.save({ session }); await audit(req, `order.${status}`, 'order', order._id, session); return order.toObject();
  }));
});
app.post('/api/orders/:id/payments', manager, async (req, res) => {
  const orderId = id.parse(req.params.id); const data = parse(z.object({ amount: money.refine(n => n > 0), reference: text }), req.body);
  res.status(201).json(await mutate(req, async session => {
    const order = await Order.findById(orderId).session(session); if (!order) fail(404, 'Order not found');
    if (!['confirmed', 'fulfilled'].includes(order.status) || order.paid + data.amount > order.total) fail(409, 'Payment exceeds balance or order is not confirmed');
    order.paid += data.amount; await order.save({ session });
    const [payment] = await Payment.create([{ order: orderId, ...data, actor: req.user._id }], { session }); await audit(req, 'payment.recorded', 'order', orderId, session); return payment.toObject();
  }));
});
app.post('/api/payments/:id/reverse', manager, async (req, res) => {
  const paymentId = id.parse(req.params.id); const { reason } = parse(z.object({ reason: text }), req.body);
  res.json(await mutate(req, async session => {
    const payment = await Payment.findById(paymentId).session(session); if (!payment) fail(404, 'Payment not found');
    if (payment.reversed || payment.reversalOf) fail(409, 'Payment cannot be reversed');
    payment.reversed = true; await payment.save({ session });
    const updated = await Order.updateOne({ _id: payment.order, paid: { $gte: payment.amount } }, { $inc: { paid: -payment.amount } }, { session });
    if (updated.matchedCount !== 1) fail(409, 'Order balance is inconsistent; reversal refused');
    const [reversal] = await Payment.create([{ order: payment.order, amount: -payment.amount, reference: reason, reversalOf: payment._id, actor: req.user._id }], { session });
    await audit(req, 'payment.reversed', 'order', payment.order, session, reason); return reversal.toObject();
  }));
});
app.get('/api/orders/:id', async (req, res) => {
  const orderId = id.parse(req.params.id); const order = await Order.findById(orderId).lean(); if (!order) fail(404, 'Order not found');
  const paymentPage = z.coerce.number().int().min(1).max(10000).parse(req.query.paymentPage || 1);
  const [payments, paymentTotal] = await Promise.all([Payment.find({ order: orderId }).sort({ createdAt: -1, _id: -1 }).skip((paymentPage - 1) * 20).limit(20).lean(), Payment.countDocuments({ order: orderId })]); res.json({ ...order, payments, paymentPage, paymentTotal });
});

}
